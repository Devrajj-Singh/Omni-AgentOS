"""Unit tests for Phase 13 Autonomous Project Builder task graph logic."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from agents.orchestrator import _build_step_context, _parse_task_graph, PREV_STEP_CONTEXT_CHARS
from models.message import Message
from models.ws_event import WSEventType
from routers.chat import orchestrate_streaming


def test_parse_task_graph_valid_json():
    """Test parsing a valid JSON task graph."""
    raw_json = """
    {
      "project_name": "fastapi-auth",
      "steps": [
        {
          "id": "step-1",
          "title": "Create project files",
          "agent": "coder",
          "action": "write_file",
          "approval_required": true,
          "description": "Create main.py and auth.py"
        },
        {
          "id": "step-2",
          "title": "Run test verification",
          "agent": "coder",
          "action": "run_command",
          "approval_required": true,
          "description": "pytest tests/"
        }
      ]
    }
    """
    graph = _parse_task_graph(raw_json)
    assert graph is not None
    assert graph["project_name"] == "fastapi-auth"
    assert len(graph["steps"]) == 2
    assert graph["steps"][0]["id"] == "step-1"
    assert graph["steps"][0]["agent"] == "coder"
    assert graph["steps"][0]["approval_required"] is True
    assert graph["steps"][0]["status"] == "pending"
    assert graph["steps"][1]["action"] == "run_command"


def test_parse_task_graph_with_code_fences_and_text():
    """Test parsing task graph wrapped in markdown code fences."""
    wrapped = """Here is the plan for your project:
```json
{
  "project_name": "react-dashboard",
  "steps": [
    {
      "id": "step-1",
      "title": "Scaffold UI components",
      "agent": "coder",
      "action": "write_file",
      "description": "Create dashboard cards"
    }
  ]
}
```
Let me know if you want to proceed!"""
    graph = _parse_task_graph(wrapped)
    assert graph is not None
    assert graph["project_name"] == "react-dashboard"
    assert len(graph["steps"]) == 1
    assert graph["steps"][0]["title"] == "Scaffold UI components"
    assert graph["steps"][0]["approval_required"] is True  # write_file defaults to approval_required=True


def test_parse_task_graph_fallback_on_invalid_json():
    """Test that invalid JSON returns None so orchestrator falls back gracefully."""
    invalid_json = "1. First step\n2. Second step\n3. Third step"
    graph = _parse_task_graph(invalid_json)
    assert graph is None


def test_build_step_context_empty():
    """Test empty context summary."""
    assert _build_step_context([]) == ""


def test_build_step_context_short():
    """Test context summary within limit."""
    outputs = ["Created main.py with hello world route", "Installed dependencies"]
    context = _build_step_context(outputs)
    assert "Created main.py" in context
    assert "Installed dependencies" in context
    assert "[...truncated" not in context


def test_build_step_context_truncation():
    """Test context summary exceeds limit and is truncated."""
    long_output = "x" * (PREV_STEP_CONTEXT_CHARS + 500)
    context = _build_step_context([long_output])
    assert len(context) <= PREV_STEP_CONTEXT_CHARS + 100
    assert "[...truncated for context window]" in context


@pytest.mark.asyncio
async def test_orchestrate_streaming_emits_task_graph_events():
    """Test that orchestrate_streaming properly emits task_graph_init and task_graph_update events."""
    session_id = "test-session-graph"
    task_id = "test-task-graph-123"
    user_message = Message(
        id="user-msg-graph",
        role="user",
        content="Build a FastAPI hello world project",
        is_streaming=False,
    )

    with patch("routers.chat.manager") as mock_manager, \
         patch("routers.chat.run_orchestrated") as mock_run_orchestrated, \
         patch("routers.chat.memory_store") as mock_memory_store, \
         patch("routers.chat.session_store") as mock_session_store:

        mock_manager.send_event = AsyncMock()
        mock_session_store.get_history.return_value = []
        mock_session_store.append_messages = MagicMock()
        mock_memory_store.get_relevant_context.return_value = ""
        mock_memory_store.save_turn = MagicMock()

        async def mock_orchestrator(**kwargs):
            # Simulate task graph init
            task_graph = {
                "project_name": "fastapi-hello-world",
                "steps": [
                    {
                        "id": "step-1",
                        "title": "Create project files",
                        "agent": "coder",
                        "action": "write_file",
                        "approval_required": True,
                        "description": "Write main.py",
                        "status": "pending",
                    }
                ],
            }
            if kwargs.get("on_task_graph_init"):
                await kwargs["on_task_graph_init"](task_graph)

            if kwargs.get("on_task_graph_update"):
                await kwargs["on_task_graph_update"]("step-1", "running", "coder")
                await kwargs["on_task_graph_update"]("step-1", "done", "coder")

            await kwargs["on_token"]("Project completed successfully.")
            return "Project completed successfully."

        mock_run_orchestrated.side_effect = mock_orchestrator

        await orchestrate_streaming(
            session_id=session_id,
            task_id=task_id,
            user_message=user_message,
            conversation_history=[],
            workspace_path="/workspace",
            active_file_path=None,
            autonomous_mode=False,
        )

        sent_event_types = [call[0][1].type for call in mock_manager.send_event.call_args_list]

        assert WSEventType.TASK_START in sent_event_types
        assert WSEventType.TASK_GRAPH_INIT in sent_event_types
        assert WSEventType.TASK_GRAPH_UPDATE in sent_event_types
        assert WSEventType.TOKEN in sent_event_types
        assert WSEventType.TASK_COMPLETE in sent_event_types

        # Verify task graph init payload
        init_event = next(
            call[0][1] for call in mock_manager.send_event.call_args_list
            if call[0][1].type == WSEventType.TASK_GRAPH_INIT
        )
        assert init_event.payload["project_name"] == "fastapi-hello-world"
        assert len(init_event.payload["steps"]) == 1
