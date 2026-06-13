"""Tests for the chat API endpoint."""
import pytest
from fastapi.testclient import TestClient
from main import create_app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    app = create_app()
    return TestClient(app)


def test_chat_endpoint_returns_202(client):
    """Test that POST /api/v1/chat returns 202 with task_id."""
    response = client.post(
        "/api/v1/chat",
        json={
            "session_id": "test-session-123",
            "message": "Hello, AI!",
            "conversation_history": []
        }
    )
    
    assert response.status_code == 202
    data = response.json()
    assert "task_id" in data
    assert data["status"] == "streaming"
    assert isinstance(data["task_id"], str)
    assert len(data["task_id"]) > 0


def test_chat_endpoint_validates_empty_session_id(client):
    """Test that empty session_id returns 422."""
    response = client.post(
        "/api/v1/chat",
        json={
            "session_id": "",
            "message": "Hello",
            "conversation_history": []
        }
    )
    
    assert response.status_code == 422


def test_chat_endpoint_validates_empty_message(client):
    """Test that empty message returns 422."""
    response = client.post(
        "/api/v1/chat",
        json={
            "session_id": "test-session-123",
            "message": "",
            "conversation_history": []
        }
    )
    
    assert response.status_code == 422


def test_chat_endpoint_accepts_conversation_history(client):
    """Test that conversation_history is accepted."""
    response = client.post(
        "/api/v1/chat",
        json={
            "session_id": "test-session-123",
            "message": "Follow-up question",
            "conversation_history": [
                {
                    "id": "msg-1",
                    "role": "user",
                    "content": "Previous message",
                    "is_streaming": False,
                    "created_at": "2024-01-01T00:00:00Z"
                },
                {
                    "id": "msg-2",
                    "role": "assistant",
                    "content": "Previous response",
                    "is_streaming": False,
                    "created_at": "2024-01-01T00:00:01Z"
                }
            ]
        }
    )
    
    assert response.status_code == 202
    data = response.json()
    assert "task_id" in data
    assert data["status"] == "streaming"
