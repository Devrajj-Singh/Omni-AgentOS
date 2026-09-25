"""Unit tests for reflection module and orchestrator reflection integration."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from agents.reflection import (
    _should_reflect,
    _parse_reflection_output,
    reflect_on_response,
)
from agents.orchestrator import _reflect_and_amend


def test_should_reflect_short_response():
    assert _should_reflect("Too short") is False


def test_should_reflect_skip_prefixes():
    long_confirmation = "Done. " + "x" * 200
    assert _should_reflect(long_confirmation) is False


def test_should_reflect_valid_response():
    valid = "This is a comprehensive response that contains sufficient detail and explanation. " * 3
    assert _should_reflect(valid) is True


def test_parse_reflection_output():
    assert _parse_reflection_output("IMPROVED: Here is better code") == (True, "Here is better code")
    assert _parse_reflection_output("LGTM: Here is good code") == (False, "Here is good code")
    assert _parse_reflection_output("Random text without prefix") == (False, "Random text without prefix")


@pytest.mark.asyncio
async def test_reflect_on_response_skipped():
    was_improved, final = await reflect_on_response("request", "short", "task-1")
    assert was_improved is False
    assert final == "short"


@pytest.mark.asyncio
async def test_reflect_on_response_improved():
    draft = "A valid draft response that is long enough to meet the minimum character threshold for reflection testing." * 2
    mock_msg = MagicMock()
    mock_msg.content = "IMPROVED: Corrected and improved draft response content."

    with patch("agents.reflection.ChatGroq") as mock_chat_groq:
        mock_llm_instance = MagicMock()
        mock_llm_instance.ainvoke = AsyncMock(return_value=mock_msg)
        mock_chat_groq.return_value = mock_llm_instance

        was_improved, final = await reflect_on_response("request", draft, "task-2")
        assert was_improved is True
        assert final == "Corrected and improved draft response content."


@pytest.mark.asyncio
async def test_reflect_on_response_lgtm():
    draft = "A valid draft response that is long enough to meet the minimum character threshold for reflection testing." * 2
    mock_msg = MagicMock()
    mock_msg.content = f"LGTM: {draft}"

    with patch("agents.reflection.ChatGroq") as mock_chat_groq:
        mock_llm_instance = MagicMock()
        mock_llm_instance.ainvoke = AsyncMock(return_value=mock_msg)
        mock_chat_groq.return_value = mock_llm_instance

        was_improved, final = await reflect_on_response("request", draft, "task-3")
        assert was_improved is False
        assert final == draft


@pytest.mark.asyncio
async def test_reflect_on_response_failure_fallback():
    draft = "A valid draft response that is long enough to meet the minimum character threshold for reflection testing." * 2

    with patch("agents.reflection.ChatGroq") as mock_chat_groq:
        mock_llm_instance = MagicMock()
        mock_llm_instance.ainvoke = AsyncMock(side_effect=RuntimeError("Groq API error"))
        mock_chat_groq.return_value = mock_llm_instance

        was_improved, final = await reflect_on_response("request", draft, "task-4")
        assert was_improved is False
        assert final == draft


@pytest.mark.asyncio
async def test_reflect_and_amend_improved():
    draft = "A valid draft response that is long enough to meet the minimum character threshold for reflection testing." * 2
    improved = "An improved version of the draft response."

    on_thinking = AsyncMock()
    on_token = AsyncMock()

    with patch("agents.orchestrator.reflect_on_response", new_callable=AsyncMock) as mock_reflect:
        mock_reflect.return_value = (True, improved)

        result = await _reflect_and_amend(
            original_request="request",
            draft_response=draft,
            task_id="task-5",
            on_thinking=on_thinking,
            on_token=on_token,
        )

        on_thinking.assert_awaited_once_with("Reflecting on response...")
        expected_amendment = f"\n\n---\n_Reflection: {improved}_"
        on_token.assert_awaited_once_with(expected_amendment)
        assert result == draft + expected_amendment


@pytest.mark.asyncio
async def test_reflect_and_amend_not_improved():
    draft = "A valid draft response that is long enough to meet the minimum character threshold for reflection testing." * 2

    on_thinking = AsyncMock()
    on_token = AsyncMock()

    with patch("agents.orchestrator.reflect_on_response", new_callable=AsyncMock) as mock_reflect:
        mock_reflect.return_value = (False, draft)

        result = await _reflect_and_amend(
            original_request="request",
            draft_response=draft,
            task_id="task-6",
            on_thinking=on_thinking,
            on_token=on_token,
        )

        on_thinking.assert_awaited_once_with("Reflecting on response...")
        on_token.assert_not_called()
        assert result == draft
