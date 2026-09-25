"""Tests for WebSocket connection manager (Redis-backed)."""
import asyncio
import json
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
    ws.send_text = AsyncMock()
    return ws


@pytest.mark.asyncio
async def test_connect_accepts_websocket(connection_manager, mock_websocket):
    """Test that connect() accepts the WebSocket and stores it."""
    session_id = "test-session-123"
    
    await connection_manager.connect(session_id, mock_websocket)
    
    try:
        mock_websocket.accept.assert_called_once()
        assert session_id in connection_manager._connections
        assert connection_manager._connections[session_id] == mock_websocket
        assert session_id in connection_manager._listener_tasks
    finally:
        await connection_manager.disconnect(session_id)


@pytest.mark.asyncio
async def test_disconnect_removes_connection(connection_manager, mock_websocket):
    """Test that disconnect() removes the connection and cancels the relay task."""
    session_id = "test-session-123"
    
    await connection_manager.connect(session_id, mock_websocket)
    assert session_id in connection_manager._connections
    
    await connection_manager.disconnect(session_id)
    assert session_id not in connection_manager._connections
    assert session_id not in connection_manager._listener_tasks


@pytest.mark.asyncio
async def test_disconnect_nonexistent_session_does_not_error(connection_manager):
    """Test that disconnect() handles non-existent sessions gracefully."""
    await connection_manager.disconnect("nonexistent-session")


@pytest.mark.asyncio
async def test_send_event_and_relay(connection_manager, mock_websocket):
    """Test that send_event() publishes to Redis and relay forwards to WebSocket."""
    session_id = "test-session-relay-123"
    await connection_manager.connect(session_id, mock_websocket)
    
    try:
        # Give the relay loop task a tiny moment to subscribe to Redis
        await asyncio.sleep(0.1)
        
        event = WSEvent(
            type=WSEventType.TOKEN,
            task_id="task-456",
            payload={"text": "Hello Redis"},
            timestamp=datetime.utcnow(),
        )
        
        await connection_manager.send_event(session_id, event)
        
        # Give the pubsub listener a moment to receive and forward the event
        await asyncio.sleep(0.2)
        
        mock_websocket.send_text.assert_called_once()
        sent_raw = mock_websocket.send_text.call_args[0][0]
        sent_data = json.loads(sent_raw)
        assert sent_data["type"] == "token"
        assert sent_data["task_id"] == "task-456"
        assert sent_data["payload"]["text"] == "Hello Redis"
    finally:
        await connection_manager.disconnect(session_id)


@pytest.mark.asyncio
async def test_send_event_to_nonexistent_session_succeeds_silently(connection_manager):
    """Test that send_event() to a session with no active connection does not raise."""
    event = WSEvent(
        type=WSEventType.ERROR,
        task_id="task-789",
        payload={"message": "Test error"},
        timestamp=datetime.utcnow(),
    )
    # Should complete without error
    await connection_manager.send_event("nonexistent-session", event)
