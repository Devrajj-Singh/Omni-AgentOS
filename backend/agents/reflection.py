"""
Reflection Agent - Phase 12.
A second LLM pass that reviews and optionally rewrites agent output.
Implements self-improvement as described in DeepLearning.AI's
Generative AI with LLMs course.
"""
from __future__ import annotations

import asyncio

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from configs.settings import app_settings
from observability.logger import log_event, timed_span

REFLECTION_SYSTEM_PROMPT = """You are a critical reviewer improving an AI assistant's response.

Your job:
1. Read the original user request and the draft response carefully.
2. Check for: incomplete answers, factual errors, missing edge cases,
   unclear explanations, or code that won't work as written.
3. If the response is good - accurate, complete, and clear - output it
   verbatim with no changes. Start your output with "LGTM: " followed
   by the response.
4. If the response needs improvement - fix it. Output the improved version
   only, starting with "IMPROVED: ". Do not explain what you changed.
   Do not include both versions.

Rules:
- Never add unnecessary caveats or hedge words that weren't in the original.
- Never make a good response longer just to seem thorough.
- For code: only flag errors that would actually break the code, not style.
- Keep the same format (markdown, code blocks) as the original response.
- If unsure whether to improve, keep the original (prefer LGTM over IMPROVED).

Output ONLY the response text (starting with LGTM: or IMPROVED:).
No preamble, no explanation of your changes."""

REFLECTION_USER_TEMPLATE = """Original request: {request}

Draft response:
{response}"""

# Responses shorter than this aren't worth reflecting on.
MIN_REFLECTION_LENGTH = 150

# Responses that are pure tool-execution confirmations don't need reflection.
SKIP_REFLECTION_PREFIXES = (
    "Done. ",
    "No content found",
    "I can't modify files",
    "I wasn't able to process",
    "Action timed out",
    "Action rejected",
)


def _should_reflect(response: str) -> bool:
    """Decide whether a response is worth reflecting on."""
    if len(response) < MIN_REFLECTION_LENGTH:
        return False
    for prefix in SKIP_REFLECTION_PREFIXES:
        if response.startswith(prefix):
            return False
    return True


def _parse_reflection_output(output: str) -> tuple[bool, str]:
    """
    Parse the reflection LLM output.
    Returns (was_improved: bool, final_response: str).
    """
    stripped = output.strip()
    if stripped.startswith("IMPROVED: "):
        return True, stripped[len("IMPROVED: "):].strip()
    if stripped.startswith("LGTM: "):
        return False, stripped[len("LGTM: "):].strip()
    return False, stripped if stripped else output


async def reflect_on_response(
    original_request: str,
    draft_response: str,
    task_id: str,
    api_key: str | None = None,
) -> tuple[bool, str]:
    """
    Run a reflection pass on a draft response.

    Does NOT stream anything and does NOT decide what to do with the
    result - that's the caller's responsibility, since different call
    sites need different behavior (stream the final result directly vs.
    append an amendment to an already-streamed response).

    Returns:
        (was_improved, final_response). If reflection is skipped, failed,
        or produced no usable output, was_improved is False and
        final_response equals draft_response unchanged.
    """
    if not _should_reflect(draft_response):
        log_event("reflection_skipped", task_id, agent="reflector",
                  reason="response too short or is a tool confirmation")
        return False, draft_response

    llm = ChatGroq(
        api_key=_get_groq_key(api_key),
        model=app_settings.active_model,
        temperature=0,
        streaming=False,
    )

    messages = [
        SystemMessage(content=REFLECTION_SYSTEM_PROMPT),
        HumanMessage(content=REFLECTION_USER_TEMPLATE.format(
            request=original_request[:500],
            response=draft_response[:3000],
        )),
    ]

    try:
        with timed_span("reflection", task_id, "reflector"):
            result = await asyncio.wait_for(llm.ainvoke(messages), timeout=30.0)
        raw_output = result.content if isinstance(result.content, str) else str(result.content)
        was_improved, final_response = _parse_reflection_output(raw_output)

        log_event(
            "reflection_complete",
            task_id,
            agent="reflector",
            was_improved=was_improved,
            draft_length=len(draft_response),
            final_length=len(final_response),
        )

        if not final_response:
            return False, draft_response

        return was_improved, final_response

    except Exception as exc:
        log_event("reflection_failed", task_id, agent="reflector", error=str(exc))
        return False, draft_response


def _get_groq_key(api_key: str | None = None) -> str:
    from dependencies.llm_factory import resolve_api_key

    return resolve_api_key(api_key)
