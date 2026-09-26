"""Multi-agent orchestrator for Planner, Researcher, Coder, and Reviewer."""
from __future__ import annotations

import json
import os
import re
import time
import asyncio
from collections.abc import Awaitable, Callable
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph

from agents.coder_agent import run_agent as run_coder_agent
from agents.reflection import (
    _should_reflect,
    reflect_on_response,
)
from configs.settings import app_settings
from dependencies.llm_factory import build_llm
from observability.logger import log_event, timed_span
from tools.websearch import TAVILY_API_KEY, TAVILY_AVAILABLE, web_search

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

PREV_STEP_CONTEXT_CHARS = 2000

PLANNER_PROMPT = """You are the Planner agent in a multi-agent AI system.
Break the user's project request into 2-5 concrete, actionable steps.
Output your response as a valid JSON object matching this exact schema:

{
  "project_name": "short-slug-name",
  "steps": [
    {
      "id": "step-1",
      "title": "Short title (under 8 words)",
      "agent": "coder",
      "action": "write_file",
      "approval_required": true,
      "description": "Specific instruction for what to create, write, or run"
    }
  ]
}

Rules:
1. "steps" must have between 2 and 5 steps.
2. "agent" must be one of: "coder", "researcher", "reviewer".
3. "action" must be one of: "write_file", "run_command", "research", "review".
4. "approval_required": MUST be true for destructive actions ("write_file", "run_command"). Must be false for "research" and "review".
5. Only include a "researcher" step if the user explicitly asked to search online or for documentation. Common frameworks (FastAPI, React, Python, Node, etc.) do NOT need research.
6. Common steps:
   - step-1: Create project structure & config files (action: "write_file", agent: "coder", approval_required: true)
   - step-2: Implement core logic/endpoints (action: "write_file", agent: "coder", approval_required: true)
   - step-3: Verification or smoke test (action: "run_command", agent: "coder", approval_required: true)
7. Respond ONLY with the valid JSON object. No preamble, no explanation, no markdown text outside the JSON."""


def _build_step_context(assembled_outputs: list[str]) -> str:
    """Summarize previous steps for context, respecting token budget."""
    if not assembled_outputs:
        return ""
    combined = "\n\n---\n\n".join(assembled_outputs)
    if len(combined) <= PREV_STEP_CONTEXT_CHARS:
        return f"Previous steps output:\n{combined}"
    truncated = combined[:PREV_STEP_CONTEXT_CHARS]
    return f"Previous steps output (truncated):\n{truncated}\n[...truncated for context window]"


def _parse_task_graph(response_text: str) -> dict[str, Any] | None:
    """Parse JSON task graph from planner response, handling code fences or minor LLM formatting.
    Returns None if parsing fails so caller can fall back to legacy plan path.
    """
    raw = response_text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        raw = raw.strip()

    match = re.search(r"(\{.*\})", raw, re.DOTALL)
    if match:
        raw = match.group(1).strip()

    try:
        data = json.loads(raw)
        if not isinstance(data, dict) or "steps" not in data or not isinstance(data["steps"], list):
            return None

        valid_steps = []
        for i, s in enumerate(data["steps"], start=1):
            if not isinstance(s, dict):
                continue
            step_id = str(s.get("id") or f"step-{i}")
            title = str(s.get("title") or f"Step {i}")
            agent = str(s.get("agent") or "coder").lower()
            if agent not in ("coder", "researcher", "reviewer"):
                agent = "coder"
            action = str(s.get("action") or "write_file").lower()
            approval_req = bool(s.get("approval_required", action in ("write_file", "run_command")))
            description = str(s.get("description") or title)
            valid_steps.append({
                "id": step_id,
                "title": title,
                "agent": agent,
                "action": action,
                "approval_required": approval_req,
                "description": description,
                "status": "pending",
            })

        if not valid_steps:
            return None

        project_name = str(data.get("project_name") or "project")
        return {
            "project_name": project_name,
            "steps": valid_steps,
        }
    except Exception:
        return None

REVIEWER_PROMPT = """You are the Reviewer agent in a multi-agent AI system.
You have been given the original task and the Coder agent's output.

Your job is to produce the FINAL response the user will see. You have two options:

Option A - The output is complete, correct, and clear:
Respond with "APPROVED: " followed by the output verbatim. No changes.

Option B - The output has errors, gaps, or unclear parts:
Respond with "REVISED: " followed by your corrected, complete version.
Do not explain what you changed. Output the corrected response only.

Rules:
- For code: only flag errors that would actually break execution.
- Keep the same format and length as the original unless a fix requires more.
- If in doubt, approve - don't add unnecessary hedges or caveats.
- Never output both versions. Never explain your decision."""

MULTI_AGENT_SIGNAL_TERMS = {
    "architect",
    "build",
    "create a",
    "design",
    "develop",
    "end-to-end",
    "implement",
    "multi-step",
    "plan",
    "refactor the",
    "scaffold",
    "set up",
}

FILE_REFERENCE_PATTERN = re.compile(r"\b[\w\-/]+\.\w{1,5}\b")

STRONG_MULTI_AGENT_TERMS = {
    "build",
    "scaffold",
    "set up",
    "develop",
    "architect",
    "design",
    "multi-step",
    "end-to-end",
}

EXPLICIT_RESEARCH_TERMS = {
    "search online",
    "search the web",
    "look up online",
    "find online",
    "find documentation for",
    "research the",
    "look up the latest",
}


class OrchestratorState(TypedDict):
    task: str
    plan: list[str] | None
    task_graph: dict[str, Any] | None
    research_findings: str | None
    coder_output: str | None
    review_notes: str | None
    workspace_root: str | None
    active_file_path: str | None
    autonomous_mode: bool
    conversation_history: list[dict[str, Any]]
    memory_context: str
    project_context: str
    final_response: str | None
    task_id: str


def _is_multi_agent_task(message: str) -> bool:
    """Lightweight classifier - NOT an LLM call.

    Mirrors the pattern used by _is_document_query in coder_agent.py for
    predictability and speed.
    """
    lowered = message.lower()
    word_count = len(message.split())

    references_specific_file = bool(FILE_REFERENCE_PATTERN.search(message))
    has_strong_signal = any(term in lowered for term in STRONG_MULTI_AGENT_TERMS)

    if references_specific_file and not has_strong_signal:
        return False

    has_signal_term = any(term in lowered for term in MULTI_AGENT_SIGNAL_TERMS)
    return has_signal_term and word_count >= 6


def _get_llm(api_key: str | None = None) -> Any:
    return build_llm(
        model_id=app_settings.active_model,
        api_key=api_key,
        temperature=0,
        streaming=False,
    )


def _needs_research(plan: list[str] | None) -> bool:
    if not plan:
        return False
    plan_text = " ".join(plan).lower()
    return any(term in plan_text for term in EXPLICIT_RESEARCH_TERMS)


def _research_available() -> bool:
    return bool(TAVILY_API_KEY and TAVILY_AVAILABLE)


async def _reflect_and_amend(
    original_request: str,
    draft_response: str,
    task_id: str,
    on_thinking: Callable[[str], Awaitable[None]],
    on_token: Callable[[str], Awaitable[None]],
    api_key: str | None = None,
) -> str:
    """
    Run reflection on an already-streamed response. If reflection produces
    a meaningfully different result, stream an amendment token.
    If the response is good as-is, return it silently with no extra output.
    """
    if not _should_reflect(draft_response):
        return draft_response

    await on_thinking("Reflecting on response...")

    was_improved, final = await reflect_on_response(
        original_request=original_request,
        draft_response=draft_response,
        task_id=task_id,
        api_key=api_key,
    )

    if was_improved and final and final != draft_response:
        amendment = f"\n\n---\n_Reflection: {final}_"
        await on_token(amendment)
        return draft_response + amendment

    return draft_response


async def _logged_tool_call(
    task_id: str,
    on_tool_call: Callable[[str, dict[str, Any]], Awaitable[None]],
    tool_name: str,
    args: dict[str, Any],
) -> None:
    log_event("tool_call", task_id, agent="coder", tool=tool_name)
    await on_tool_call(tool_name, args)


async def _logged_tool_result(
    task_id: str,
    on_tool_result: Callable[[str, str], Awaitable[None]],
    tool_name: str,
    result: str,
    duration_ms: float | None = None,
) -> None:
    fields: dict[str, Any] = {"tool": tool_name, "result_length": len(result)}
    if duration_ms is not None:
        fields["duration_ms"] = duration_ms
    log_event("tool_result", task_id, agent="coder", **fields)
    await on_tool_result(tool_name, result)


async def run_orchestrated(
    message: str,
    conversation_history: list[dict[str, Any]],
    workspace_root: str | None,
    active_file_path: str | None,
    memory_context: str,
    autonomous_mode: bool,
    task_id: str,
    on_token: Callable[[str], Awaitable[None]],
    on_tool_call: Callable[[str, dict[str, Any]], Awaitable[None]],
    on_tool_result: Callable[[str, str], Awaitable[None]],
    on_thinking: Callable[[str], Awaitable[None]],
    on_approval_required: Callable[[str, str, dict[str, Any], str, str], Awaitable[None]],
    on_approval_resolved: Callable[[str, str], Awaitable[None]],
    on_handoff: Callable[[str | None, str, str], Awaitable[None]],
    project_context: str = "",
    api_key: str | None = None,
    on_task_graph_init: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
    on_task_graph_update: Callable[[str, str, str], Awaitable[None]] | None = None,
) -> str:
    """Route simple requests to Coder or complex requests through the graph."""
    token_char_count = 0
    tool_start_times: dict[str, float] = {}

    async def counting_on_token(text: str) -> None:
        nonlocal token_char_count
        token_char_count += len(text)
        await on_token(text)

    async def wrapped_on_tool_call(tool_name: str, args: dict[str, Any]) -> None:
        tool_start_times[tool_name] = time.perf_counter()
        await _logged_tool_call(task_id, on_tool_call, tool_name, args)

    async def wrapped_on_tool_result(tool_name: str, result: str) -> None:
        started_at = tool_start_times.pop(tool_name, None)
        duration_ms = None
        if started_at is not None:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        await _logged_tool_result(task_id, on_tool_result, tool_name, result, duration_ms)

    def finish_response(response: str) -> str:
        log_event("task_summary", task_id, agent=None, response_char_count=token_char_count)
        return response

    async def emit_handoff(from_agent: str | None, to_agent: str, reason: str) -> None:
        log_event(
            "handoff",
            task_id,
            agent=to_agent,
            from_agent=from_agent,
            to_agent=to_agent,
            reason=reason,
        )
        await on_handoff(from_agent, to_agent, reason)

    if not _is_multi_agent_task(message):
        log_event("routing_decision", task_id, agent=None, route="direct_coder")
        await emit_handoff(None, "coder", "Single-step request routed directly")
        effective_memory_context = "\n\n".join(
            filter(None, [project_context, memory_context])
        ).strip()
        response = await run_coder_agent(
            message=message,
            conversation_history=conversation_history,
            workspace_root=workspace_root,
            active_file_path=active_file_path,
            memory_context=effective_memory_context,
            autonomous_mode=autonomous_mode,
            on_token=counting_on_token,
            on_tool_call=wrapped_on_tool_call,
            on_tool_result=wrapped_on_tool_result,
            on_thinking=on_thinking,
            on_approval_required=on_approval_required,
            on_approval_resolved=on_approval_resolved,
            api_key=api_key,
        )
        response = await _reflect_and_amend(
            original_request=message,
            draft_response=response,
            task_id=task_id,
            on_thinking=on_thinking,
            on_token=counting_on_token,
            api_key=api_key,
        )
        return finish_response(response)

    log_event("routing_decision", task_id, agent=None, route="multi_agent")

    async def planner_node(state: OrchestratorState) -> dict[str, Any]:
        await emit_handoff(None, "planner", "Multi-step request detected - planning")
        await on_thinking("Planning the project approach...")
        with timed_span("agent_run", task_id, "planner"):
            response = await _get_llm(api_key).ainvoke(
                [SystemMessage(content=PLANNER_PROMPT), HumanMessage(content=state["task"])]
            )
            plan_text = response.content if isinstance(response.content, str) else str(response.content)
            task_graph = _parse_task_graph(plan_text)
            if task_graph:
                plan = [s["title"] for s in task_graph["steps"]]
                log_event(
                    "task_graph_created",
                    task_id,
                    agent="planner",
                    project_name=task_graph["project_name"],
                    steps=task_graph["steps"],
                )
                if on_task_graph_init:
                    await on_task_graph_init(task_graph)
            else:
                plan = [line.strip() for line in plan_text.splitlines() if line.strip()]
                log_event("plan_created", task_id, agent="planner", steps=plan)

        return {"plan": plan, "task_graph": task_graph}

    async def project_builder_node(state: OrchestratorState) -> dict[str, Any]:
        task_graph = state.get("task_graph")
        if not task_graph or not task_graph.get("steps"):
            return {"coder_output": "No steps to execute."}

        assembled_outputs: list[str] = []
        research_findings = state.get("research_findings") or ""
        prev_agent = "planner"

        for step in task_graph["steps"]:
            step_id = step["id"]
            agent_name = step["agent"]
            title = step["title"]
            description = step["description"]

            # 1. Update step status to running
            if on_task_graph_update:
                await on_task_graph_update(step_id, "running", agent_name)

            await emit_handoff(prev_agent, agent_name, f"Executing: {title}")
            prev_agent = agent_name

            if agent_name == "researcher":
                await on_thinking(f"Researching: {title}...")
                with timed_span("agent_run", task_id, "researcher"):
                    await wrapped_on_tool_call("web_search_tool", {"query": description})
                    findings = web_search(description)
                    await wrapped_on_tool_result("web_search_tool", findings[:500])
                research_findings = f"{research_findings}\n\n{findings}".strip()
                if on_task_graph_update:
                    await on_task_graph_update(step_id, "done", agent_name)
                continue

            elif agent_name == "reviewer":
                await on_thinking(f"Reviewing: {title}...")
                current_assembled = "\n\n".join(assembled_outputs)
                with timed_span("agent_run", task_id, "reviewer"):
                    review_input = f"Task: {state['task']}\nStep: {description}\nCurrent Output:\n{current_assembled}"
                    response = await _get_llm(api_key).ainvoke(
                        [SystemMessage(content=REVIEWER_PROMPT), HumanMessage(content=review_input)]
                    )
                    review_text = response.content if isinstance(response.content, str) else str(response.content)
                if on_task_graph_update:
                    await on_task_graph_update(step_id, "done", agent_name)
                continue

            # Default: Coder agent
            await on_thinking(f"Implementing: {title}...")

            # Context budget
            step_context_parts = []
            if state["project_context"]:
                step_context_parts.append(state["project_context"])
            if state["memory_context"]:
                step_context_parts.append(state["memory_context"])
            if research_findings:
                step_context_parts.append(f"Research findings:\n{research_findings[:1500]}")
            prev_context = _build_step_context(assembled_outputs)
            if prev_context:
                step_context_parts.append(prev_context)
            step_context = "\n\n".join(step_context_parts).strip()

            step_message = (
                f"Overall Project Goal: {state['task']}\n\n"
                f"Current Step: {title}\n"
                f"Action Required: {description}"
            )

            # Wrap approval callbacks to track awaiting_approval status on current step
            async def step_on_approval_required(
                approval_id: str,
                tool_name: str,
                args: dict[str, Any],
                approval_desc: str,
                risk_level: str,
            ) -> None:
                if on_task_graph_update:
                    await on_task_graph_update(step_id, "awaiting_approval", agent_name)
                await on_approval_required(approval_id, tool_name, args, approval_desc, risk_level)

            async def step_on_approval_resolved(approval_id: str, decision: str) -> None:
                if on_task_graph_update:
                    next_status = "running" if decision == "approved" else "skipped"
                    await on_task_graph_update(step_id, next_status, agent_name)
                await on_approval_resolved(approval_id, decision)

            with timed_span("agent_run", task_id, "coder"):
                output = await run_coder_agent(
                    message=step_message,
                    conversation_history=state["conversation_history"],
                    workspace_root=state["workspace_root"],
                    active_file_path=state["active_file_path"],
                    memory_context=step_context,
                    autonomous_mode=state["autonomous_mode"],
                    on_token=counting_on_token,
                    on_tool_call=wrapped_on_tool_call,
                    on_tool_result=wrapped_on_tool_result,
                    on_thinking=on_thinking,
                    on_approval_required=step_on_approval_required,
                    on_approval_resolved=step_on_approval_resolved,
                    api_key=api_key,
                )

            assembled_outputs.append(output)
            if on_task_graph_update:
                await on_task_graph_update(step_id, "done", agent_name)

        final_assembled = "\n\n".join(assembled_outputs)
        return {"coder_output": final_assembled, "final_response": final_assembled}

    async def researcher_node(state: OrchestratorState) -> dict[str, Any]:
        await emit_handoff("planner", "researcher", "Plan requires research")
        await on_thinking("Researching...")
        with timed_span("agent_run", task_id, "researcher"):
            await wrapped_on_tool_call("web_search_tool", {"query": state["task"]})
            research_findings = web_search(state["task"])
            await wrapped_on_tool_result("web_search_tool", research_findings[:500])
        log_event(
            "research_complete",
            task_id,
            agent="researcher",
            result_preview=research_findings[:200],
        )
        return {"research_findings": research_findings}

    async def coder_node(state: OrchestratorState) -> dict[str, Any]:
        from_agent = "researcher" if state.get("research_findings") else "planner"
        await emit_handoff(from_agent, "coder", "Executing the plan")
        await on_thinking("Implementing...")

        coder_context = "\n\n".join(
            filter(None, [state["project_context"], state["memory_context"]])
        ).strip()
        research = state.get("research_findings") or ""
        if research:
            research_trimmed = research[:1500]
            coder_context = f"{coder_context}\n\nResearch findings:\n{research_trimmed}".strip()

        plan_steps = state.get("plan") or []
        plan_str = "\n".join(plan_steps[:5])
        if len(plan_str) > 800:
            plan_str = plan_str[:800] + "\n[plan truncated]"

        coder_message = f"{state['task']}\n\nPlan:\n{plan_str}".strip()

        with timed_span("agent_run", task_id, "coder"):
            coder_output = await run_coder_agent(
                message=coder_message,
                conversation_history=state["conversation_history"],
                workspace_root=state["workspace_root"],
                active_file_path=state["active_file_path"],
                memory_context=coder_context,
                autonomous_mode=state["autonomous_mode"],
                on_token=counting_on_token,
                on_tool_call=wrapped_on_tool_call,
                on_tool_result=wrapped_on_tool_result,
                on_thinking=on_thinking,
                on_approval_required=on_approval_required,
                on_approval_resolved=on_approval_resolved,
                api_key=api_key,
            )
        log_event("coder_complete", task_id, agent="coder", output_preview=coder_output[:200])
        return {"coder_output": coder_output}

    async def reviewer_node(state: OrchestratorState) -> dict[str, Any]:
        await emit_handoff("coder", "reviewer", "Reviewing the result")
        await on_thinking("Reviewing the output...")
        coder_output = state.get("coder_output") or ""
        with timed_span("agent_run", task_id, "reviewer"):
            review_input = f"Original task: {state['task']}\n\nOutput produced:\n{coder_output}"
            response = await _get_llm(api_key).ainvoke(
                [SystemMessage(content=REVIEWER_PROMPT), HumanMessage(content=review_input)]
            )
            review_text = response.content if isinstance(response.content, str) else str(response.content)
        log_event("review_complete", task_id, agent="reviewer", verdict=review_text[:200])

        stripped = review_text.strip()
        if stripped.startswith("APPROVED: "):
            final_response = stripped[len("APPROVED: "):].strip()
            if not final_response:
                final_response = coder_output
        elif stripped.startswith("REVISED: "):
            final_response = stripped[len("REVISED: "):].strip()
            if not final_response:
                final_response = coder_output
        else:
            final_response = coder_output
        return {"review_notes": review_text, "final_response": final_response}

    def route_after_planner(state: OrchestratorState) -> str:
        if state.get("task_graph"):
            return "project_builder"
        return "researcher" if _needs_research(state.get("plan")) and _research_available() else "coder"

    graph = StateGraph(OrchestratorState)
    graph.add_node("planner", planner_node)
    graph.add_node("project_builder", project_builder_node)
    graph.add_node("researcher", researcher_node)
    graph.add_node("coder", coder_node)
    graph.add_node("reviewer", reviewer_node)
    graph.set_entry_point("planner")
    graph.add_conditional_edges(
        "planner",
        route_after_planner,
        {
            "project_builder": "project_builder",
            "researcher": "researcher",
            "coder": "coder",
        },
    )
    graph.add_edge("project_builder", "reviewer")
    graph.add_edge("researcher", "coder")
    graph.add_edge("coder", "reviewer")
    graph.add_edge("reviewer", END)

    initial_state: OrchestratorState = {
        "task": message,
        "plan": None,
        "task_graph": None,
        "research_findings": None,
        "coder_output": None,
        "review_notes": None,
        "workspace_root": workspace_root,
        "active_file_path": active_file_path,
        "autonomous_mode": autonomous_mode,
        "conversation_history": conversation_history,
        "memory_context": memory_context,
        "project_context": project_context,
        "final_response": None,
        "task_id": task_id,
    }
    final_state = await graph.compile().ainvoke(initial_state)
    draft_response = final_state.get("final_response") or final_state.get("coder_output") or ""
    final_response = await _reflect_and_amend(
        original_request=message,
        draft_response=draft_response,
        task_id=task_id,
        on_thinking=on_thinking,
        on_token=counting_on_token,
        api_key=api_key,
    )
    return finish_response(final_response)
