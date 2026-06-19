"""Multi-agent orchestrator for Planner, Researcher, Coder, and Reviewer."""
from __future__ import annotations

import os
from collections.abc import Awaitable, Callable
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph

from agents.coder_agent import run_agent as run_coder_agent
from configs.settings import app_settings
from observability.logger import log_event, timed_span
from tools.websearch import TAVILY_API_KEY, TAVILY_AVAILABLE, web_search

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

PLANNER_PROMPT = """You are the Planner agent in a multi-agent system. Break the
user's request into 2-5 concrete steps. Each step should be assignable to either
the Researcher (web/document lookup) or the Coder (file operations, code,
terminal commands). Respond with ONLY a numbered list of steps, nothing else."""

REVIEWER_PROMPT = """You are the Reviewer agent in a multi-agent system. You will
be shown the original task and the Coder/Researcher's output. Check it is
complete, correct, and addresses the original request. If it's good, respond
with "APPROVED: " followed by a one-sentence summary for the user. If something
is missing or wrong, respond with "REVISE: " followed by what's missing - be
specific and brief."""

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


class OrchestratorState(TypedDict):
    task: str
    plan: list[str] | None
    research_findings: str | None
    coder_output: str | None
    review_notes: str | None
    workspace_root: str | None
    active_file_path: str | None
    autonomous_mode: bool
    conversation_history: list[dict[str, Any]]
    memory_context: str
    final_response: str | None
    task_id: str


def _is_multi_agent_task(message: str) -> bool:
    """Lightweight classifier - intentionally not an LLM call."""
    lowered = message.lower()
    word_count = len(message.split())
    has_signal_term = any(term in lowered for term in MULTI_AGENT_SIGNAL_TERMS)
    return has_signal_term and word_count >= 6


def _get_llm() -> ChatGroq:
    return ChatGroq(
        api_key=GROQ_API_KEY,
        model=app_settings.active_model,
        temperature=0,
        streaming=False,
    )


def _needs_research(plan: list[str] | None) -> bool:
    if not plan:
        return False
    research_terms = ("research", "search", "look up", "find documentation", "find out")
    return any(any(term in step.lower() for term in research_terms) for step in plan)


def _research_available() -> bool:
    return bool(TAVILY_API_KEY and TAVILY_AVAILABLE)


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
    on_handoff: Callable[[str | None, str, str], Awaitable[None]],
) -> str:
    """Route simple requests to Coder or complex requests through the graph."""

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
        return await run_coder_agent(
            message=message,
            conversation_history=conversation_history,
            workspace_root=workspace_root,
            active_file_path=active_file_path,
            memory_context=memory_context,
            autonomous_mode=autonomous_mode,
            on_token=on_token,
            on_tool_call=on_tool_call,
            on_tool_result=on_tool_result,
            on_thinking=on_thinking,
            on_approval_required=on_approval_required,
        )

    log_event("routing_decision", task_id, agent=None, route="multi_agent")

    async def planner_node(state: OrchestratorState) -> dict[str, Any]:
        await emit_handoff(None, "planner", "Multi-step request detected - planning")
        await on_thinking("Planning the approach...")
        with timed_span("agent_run", task_id, "planner"):
            response = await _get_llm().ainvoke(
                [SystemMessage(content=PLANNER_PROMPT), HumanMessage(content=state["task"])]
            )
            plan_text = response.content if isinstance(response.content, str) else str(response.content)
            plan = [line.strip() for line in plan_text.splitlines() if line.strip()]
        log_event("plan_created", task_id, agent="planner", steps=plan)
        return {"plan": plan}

    async def researcher_node(state: OrchestratorState) -> dict[str, Any]:
        await emit_handoff("planner", "researcher", "Plan requires research")
        await on_thinking("Researching...")
        with timed_span("agent_run", task_id, "researcher"):
            await on_tool_call("web_search_tool", {"query": state["task"]})
            research_findings = web_search(state["task"])
            await on_tool_result("web_search_tool", research_findings[:500])
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

        coder_context = state["memory_context"]
        if state.get("research_findings"):
            coder_context = f"{coder_context}\n\nResearch findings:\n{state['research_findings']}".strip()
        plan_str = "\n".join(state.get("plan") or [])
        coder_message = f"{state['task']}\n\nPlan to follow:\n{plan_str}".strip()

        with timed_span("agent_run", task_id, "coder"):
            coder_output = await run_coder_agent(
                message=coder_message,
                conversation_history=state["conversation_history"],
                workspace_root=state["workspace_root"],
                active_file_path=state["active_file_path"],
                memory_context=coder_context,
                autonomous_mode=state["autonomous_mode"],
                on_token=on_token,
                on_tool_call=on_tool_call,
                on_tool_result=on_tool_result,
                on_thinking=on_thinking,
                on_approval_required=on_approval_required,
            )
        log_event("coder_complete", task_id, agent="coder", output_preview=coder_output[:200])
        return {"coder_output": coder_output}

    async def reviewer_node(state: OrchestratorState) -> dict[str, Any]:
        await emit_handoff("coder", "reviewer", "Reviewing the result")
        await on_thinking("Reviewing the output...")
        coder_output = state.get("coder_output") or ""
        with timed_span("agent_run", task_id, "reviewer"):
            review_input = f"Original task: {state['task']}\n\nOutput produced:\n{coder_output}"
            response = await _get_llm().ainvoke(
                [SystemMessage(content=REVIEWER_PROMPT), HumanMessage(content=review_input)]
            )
            review_text = response.content if isinstance(response.content, str) else str(response.content)
        log_event("review_complete", task_id, agent="reviewer", verdict=review_text[:200])

        if review_text.strip().upper().startswith("APPROVED"):
            summary = review_text.split(":", 1)[-1].strip() if ":" in review_text else review_text
            final_response = f"{coder_output}\n\n_Reviewed: {summary}_"
        else:
            final_response = f"{coder_output}\n\n_Review note: {review_text}_"
        return {"review_notes": review_text, "final_response": final_response}

    def route_after_planner(state: OrchestratorState) -> str:
        return "researcher" if _needs_research(state.get("plan")) and _research_available() else "coder"

    graph = StateGraph(OrchestratorState)
    graph.add_node("planner", planner_node)
    graph.add_node("researcher", researcher_node)
    graph.add_node("coder", coder_node)
    graph.add_node("reviewer", reviewer_node)
    graph.set_entry_point("planner")
    graph.add_conditional_edges(
        "planner",
        route_after_planner,
        {"researcher": "researcher", "coder": "coder"},
    )
    graph.add_edge("researcher", "coder")
    graph.add_edge("coder", "reviewer")
    graph.add_edge("reviewer", END)

    initial_state: OrchestratorState = {
        "task": message,
        "plan": None,
        "research_findings": None,
        "coder_output": None,
        "review_notes": None,
        "workspace_root": workspace_root,
        "active_file_path": active_file_path,
        "autonomous_mode": autonomous_mode,
        "conversation_history": conversation_history,
        "memory_context": memory_context,
        "final_response": None,
        "task_id": task_id,
    }
    final_state = await graph.compile().ainvoke(initial_state)
    return final_state.get("final_response") or final_state.get("coder_output") or ""
