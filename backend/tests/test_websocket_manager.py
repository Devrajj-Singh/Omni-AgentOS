"""Tests for WebSocket connection manager."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

from websocket.manager import ConnectionManager
from models.ws_event import WSEvent, WSEventType


@pytest.fixture
def connection_manager():
    """Create a fresh ConnectionManager instance for each test."""
    return ConnectionManager()


@pytest.fixture
def mock_websocket():
    """Create a mock WebSocket instance."""
    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    return ws


@pytest.mark.asyncio
async def test_connect_accepts_websocket(connection_manager, mock_websocket):
    """Test that connect() accepts the WebSocket and stores it."""
    session_id = "test-session-123"
    
    await connection_manager.connect(session_id, mock_websocket)
    
    mock_websocket.accept.assert_called_once()
    assert session_id in connection_manager._connections
    assert connection_manager._connections[session_id] == mock_websocket


@pytest.mark.asyncio
async def test_disconnect_removes_connection(connection_manager, mock_websocket):
    """Test that disconnect() removes the connection from the dict."""
    session_id = "test-session-123"
    
    await connection_manager.connect(session_id, mock_websocket)
    assert session_id in connection_manager._connections
    
    await connection_manager.disconnect(session_id)
    assert session_id not in connection_manager._connections


@pytest.mark.asyncio
async def test_disconnect_nonexistent_session_does_not_error(connection_manager):
    """Test that disconnect() handles non-existent sessions gracefully."""
    # Should not raise an exception
    await connection_manager.disconnect("nonexistent-session")


@pytest.mark.asyncio
async def test_send_event_sends_json(connection_manager, mock_websocket):
    """Test that send_event() sends the event as JSON to the correct session."""
    session_id = "test-session-123"
    await connection_manager.connect(session_id, mock_websocket)
    
    event = WSEvent(
        type=WSEventType.TOKEN,
        task_id="task-456",
        payload={"text": "Hello"},
        timestamp=datetime.utcnow()
    )
    
    await connection_manager.send_event(session_id, event)
    
    mock_websocket.send_json.assert_called_once()
    sent_data = mock_websocket.send_json.call_args[0][0]
    assert sent_data["type"] == "token"
    assert sent_data["task_id"] == "task-456"
    assert sent_data["payload"]["text"] == "Hello"


@pytest.mark.asyncio
async def test_send_event_to_nonexistent_session_logs_warning(
    connection_manager, caplog
):
    """Test that send_event() logs a warning for non-existent sessions."""
    event = WSEvent(
        type=WSEventType.ERROR,
        task_id="task-789",
        payload={"message": "Test error"},
        timestamp=datetime.utcnow()
    )
    
    await connection_manager.send_event("nonexistent-session", event)
    
    # Check that a warning was logged
    assert any(
        "non-existent session" in record.message.lower()
        for record in caplog.records
        if record.levelname == "WARNING"
    )


@pytest.mark.asyncio
async def test_multiple_sessions(connection_manager):
    """Test that multiple sessions can be managed independently."""
    ws1 = MagicMock()
    ws1.accept = AsyncMock()
    ws1.send_json = AsyncMock()
    
    ws2 = MagicMock()
    ws2.accept = AsyncMock()
    ws2.send_json = AsyncMock()
    
    await connection_manager.connect("session-1", ws1)
    await connection_manager.connect("session-2", ws2)
    
    assert len(connection_manager._connections) == 2
    
    event = WSEvent(
        type=WSEventType.TASK_START,
        task_id="task-123",
        payload={"messageId": "msg-1"},
        timestamp=datetime.utcnow()
    )
    
    await connection_manager.send_event("session-1", event)
    
    ws1.send_json.assert_called_once()
    ws2.send_json.assert_not_called()
