"""Integration tests for orchestrate_streaming function."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from routers.chat import orchestrate_streaming
from models.message import Message
from models.ws_event import WSEvent, WSEventType


@pytest.mark.asyncio
async def test_orchestrate_streaming_happy_path():
    """Test successful streaming orchestration."""
    session_id = "test-session-123"
    task_id = "test-task-456"
    user_message = Message(
        id="user-msg-1",
        role="user",
        content="Hello, AI!",
        is_streaming=False
    )
    conversation_history = []
    
    # Mock the manager, run_orchestrated, and memory store
    with patch('routers.chat.manager') as mock_manager, \
         patch('routers.chat.run_orchestrated') as mock_run_orchestrated, \
         patch('routers.chat.memory_store') as mock_memory_store, \
         patch('routers.chat.session_store') as mock_session_store:
        
        # Setup mocks
        mock_manager.send_event = AsyncMock()
        mock_session_store.get_history.return_value = []
        mock_session_store.append_messages = MagicMock()
        mock_memory_store.get_relevant_context.return_value = "Relevant past conversations:"
        mock_memory_store.save_turn = MagicMock()

        async def mock_agent(**kwargs):
            await kwargs["on_token"]("Hello")
            await kwargs["on_token"](" there")
            await kwargs["on_token"]("!")
            return "Hello there!"

        mock_run_orchestrated.side_effect = mock_agent
        
        # Execute orchestration
        await orchestrate_streaming(
            session_id=session_id,
            task_id=task_id,
            user_message=user_message,
            conversation_history=conversation_history,
            workspace_path=None,
            active_file_path=None,
            autonomous_mode=False,
        )
        
        # Verify events were sent in correct order
        assert mock_manager.send_event.call_count == 5  # task.start + 3 tokens + task.complete
        
        # Verify task.start event
        call_args = mock_manager.send_event.call_args_list[0]
        assert call_args[0][0] == session_id
        event = call_args[0][1]
        assert event.type == WSEventType.TASK_START
        assert event.task_id == task_id
        assert "messageId" in event.payload
        
        # Verify token events
        for i, token_text in enumerate(["Hello", " there", "!"], start=1):
            call_args = mock_manager.send_event.call_args_list[i]
            event = call_args[0][1]
            assert event.type == WSEventType.TOKEN
            assert event.payload["text"] == token_text
        
        # Verify task.complete event
        call_args = mock_manager.send_event.call_args_list[4]
        event = call_args[0][1]
        assert event.type == WSEventType.TASK_COMPLETE
        assert event.payload["taskId"] == task_id
        assert event.payload["messageCount"] == 2
        
        # Verify messages were saved to session store
        mock_session_store.append_messages.assert_called_once()
        saved_messages = mock_session_store.append_messages.call_args[0][1]
        assert len(saved_messages) == 2
        assert saved_messages[0].role == "user"
        assert saved_messages[1].role == "assistant"
        assert saved_messages[1].content == "Hello there!"
        mock_memory_store.get_relevant_context.assert_called_once_with(
            query="Hello, AI!",
            n_results=3,
        )
        mock_memory_store.save_turn.assert_called_once_with(
            session_id=session_id,
            user_message="Hello, AI!",
            assistant_message="Hello there!",
            workspace_path=None,
        )


@pytest.mark.asyncio
async def test_orchestrate_streaming_error_handling():
    """Test error handling in streaming orchestration."""
    session_id = "test-session-123"
    task_id = "test-task-456"
    user_message = Message(
        id="user-msg-1",
        role="user",
        content="Hello, AI!",
        is_streaming=False
    )
    conversation_history = []
    
    # Mock the manager and run_orchestrated to raise an error
    with patch('routers.chat.manager') as mock_manager, \
         patch('routers.chat.run_orchestrated') as mock_run_orchestrated, \
         patch('routers.chat.memory_store') as mock_memory_store, \
         patch('routers.chat.session_store') as mock_session_store:
        
        # Setup mocks
        mock_manager.send_event = AsyncMock()
        mock_session_store.get_history.return_value = []
        mock_memory_store.get_relevant_context.return_value = ""
        mock_run_orchestrated.side_effect = Exception("API Error")
        
        # Execute orchestration
        await orchestrate_streaming(
            session_id=session_id,
            task_id=task_id,
            user_message=user_message,
            conversation_history=conversation_history,
            workspace_path=None,
            active_file_path=None,
            autonomous_mode=False,
        )
        
        # Verify task.start was sent
        first_call = mock_manager.send_event.call_args_list[0]
        assert first_call[0][1].type == WSEventType.TASK_START
        
        # Verify error event was sent
        last_call = mock_manager.send_event.call_args_list[-1]
        event = last_call[0][1]
        assert event.type == WSEventType.ERROR
        assert event.task_id == task_id
        assert "API Error" in event.payload["message"]
        assert event.payload["canRetry"] is True


@pytest.mark.asyncio
async def test_orchestrate_streaming_with_conversation_history():
    """Test streaming with existing conversation history."""
    session_id = "test-session-123"
    task_id = "test-task-456"
    user_message = Message(
        id="user-msg-2",
        role="user",
        content="Follow-up question",
        is_streaming=False
    )
    conversation_history = [
        Message(
            id="user-msg-1",
            role="user",
            content="First message",
            is_streaming=False
        ),
        Message(
            id="assistant-msg-1",
            role="assistant",
            content="First response",
            is_streaming=False
        )
    ]
    
    # Mock the manager and run_orchestrated
    with patch('routers.chat.manager') as mock_manager, \
         patch('routers.chat.run_orchestrated') as mock_run_orchestrated, \
         patch('routers.chat.memory_store') as mock_memory_store, \
         patch('routers.chat.session_store') as mock_session_store:
        
        # Setup mocks
        mock_manager.send_event = AsyncMock()
        mock_session_store.get_history.return_value = []
        mock_session_store.append_messages = MagicMock()
        mock_memory_store.get_relevant_context.return_value = ""

        async def mock_agent(**kwargs):
            assert len(kwargs["conversation_history"]) == 2
            assert kwargs["message"] == "Follow-up question"
            await kwargs["on_token"]("Response")
            return "Response"

        mock_run_orchestrated.side_effect = mock_agent
        
        # Execute orchestration
        await orchestrate_streaming(
            session_id=session_id,
            task_id=task_id,
            user_message=user_message,
            conversation_history=conversation_history,
            workspace_path=None,
            active_file_path=None,
            autonomous_mode=False,
        )
        
        mock_run_orchestrated.assert_called_once()
        assert mock_run_orchestrated.call_args.kwargs["autonomous_mode"] is False
        assert "on_approval_required" in mock_run_orchestrated.call_args.kwargs
        assert "on_handoff" in mock_run_orchestrated.call_args.kwargs
        assert mock_run_orchestrated.call_args.kwargs["conversation_history"] == [
            {"role": "user", "content": "First message"},
            {"role": "assistant", "content": "First response"},
        ]


@pytest.mark.asyncio
async def test_orchestrate_streaming_emits_approval_required():
    """Test approval callback emits approval.required events."""
    session_id = "test-session-123"
    task_id = "test-task-456"
    user_message = Message(
        id="user-msg-1",
        role="user",
        content="Create a file",
        is_streaming=False
    )

    with patch('routers.chat.manager') as mock_manager, \
         patch('routers.chat.run_orchestrated') as mock_run_orchestrated, \
         patch('routers.chat.memory_store') as mock_memory_store, \
         patch('routers.chat.session_store') as mock_session_store:

        mock_manager.send_event = AsyncMock()
        mock_session_store.append_messages = MagicMock()
        mock_memory_store.get_relevant_context.return_value = ""
        mock_memory_store.save_turn = MagicMock()

        async def mock_agent(**kwargs):
            await kwargs["on_approval_required"](
                "approval-1",
                "write_file_tool",
                {"path": "test.py"},
                "Write 12 characters to `test.py`",
                "medium",
            )
            return "Done."

        mock_run_orchestrated.side_effect = mock_agent

        await orchestrate_streaming(
            session_id=session_id,
            task_id=task_id,
            user_message=user_message,
            conversation_history=[],
            workspace_path="C:/workspace",
            active_file_path=None,
            autonomous_mode=False,
        )

        approval_events = [
            call_args[0][1]
            for call_args in mock_manager.send_event.call_args_list
            if call_args[0][1].type == WSEventType.APPROVAL_REQUIRED
        ]
        assert len(approval_events) == 1
        assert approval_events[0].payload == {
            "approvalId": "approval-1",
            "tool": "write_file_tool",
            "args": {"path": "test.py"},
            "description": "Write 12 characters to `test.py`",
            "riskLevel": "medium",
        }


@pytest.mark.asyncio
async def test_orchestrate_streaming_emits_agent_handoff():
    """Test handoff callback emits agent.handoff events."""
    session_id = "test-session-123"
    task_id = "test-task-456"
    user_message = Message(
        id="user-msg-1",
        role="user",
        content="Build a health check endpoint",
        is_streaming=False
    )

    with patch('routers.chat.manager') as mock_manager, \
         patch('routers.chat.run_orchestrated') as mock_run_orchestrated, \
         patch('routers.chat.memory_store') as mock_memory_store, \
         patch('routers.chat.session_store') as mock_session_store:

        mock_manager.send_event = AsyncMock()
        mock_session_store.append_messages = MagicMock()
        mock_memory_store.get_relevant_context.return_value = ""
        mock_memory_store.save_turn = MagicMock()

        async def mock_orchestrated(**kwargs):
            await kwargs["on_handoff"](None, "planner", "Multi-step request detected - planning")
            return "Done."

        mock_run_orchestrated.side_effect = mock_orchestrated

        await orchestrate_streaming(
            session_id=session_id,
            task_id=task_id,
            user_message=user_message,
            conversation_history=[],
            workspace_path="C:/workspace",
            active_file_path=None,
            autonomous_mode=False,
        )

        handoff_events = [
            call_args[0][1]
            for call_args in mock_manager.send_event.call_args_list
            if call_args[0][1].type == WSEventType.AGENT_HANDOFF
        ]
        assert len(handoff_events) == 1
        assert handoff_events[0].payload == {
            "fromAgent": None,
            "toAgent": "planner",
            "reason": "Multi-step request detected - planning",
        }
