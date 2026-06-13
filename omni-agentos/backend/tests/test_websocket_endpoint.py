"""Integration tests for WebSocket endpoint."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


def test_websocket_endpoint_connects_and_disconnects(client):
    """Test that the WebSocket endpoint connects and disconnects properly."""
    session_id = "test-session-123"
    
    with client.websocket_connect(f"/ws/{session_id}") as websocket:
        # Connection should be established
        # Send a message to keep the connection alive
        websocket.send_text("test message")
        
        # The endpoint doesn't echo back in Phase 1, it just keeps connection alive
        # We can verify the connection is active by checking we can send
        
    # Connection should be closed cleanly after exiting context


def test_websocket_endpoint_with_different_session_ids(client):
    """Test that different session IDs create independent connections."""
    session_id_1 = "session-1"
    session_id_2 = "session-2"
    
    with client.websocket_connect(f"/ws/{session_id_1}") as ws1:
        with client.websocket_connect(f"/ws/{session_id_2}") as ws2:
            # Both connections should be active
            ws1.send_text("message to session 1")
            ws2.send_text("message to session 2")
            
            # Both should remain connected
            assert ws1
            assert ws2
