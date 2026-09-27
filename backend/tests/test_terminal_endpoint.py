"""Unit and integration tests for Terminal WebSocket endpoint."""
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


def test_terminal_websocket_connects_and_runs(client):
    """Test connecting to /ws/terminal with workspace_root."""
    with patch("routers.terminal._pty_session", new_callable=AsyncMock) as mock_pty:
        with client.websocket_connect("/ws/terminal?workspace_root=.") as ws:
            assert ws is not None

        mock_pty.assert_called_once()


def test_terminal_websocket_defaults_invalid_workspace(client):
    """Test connecting to /ws/terminal with invalid directory falls back safely."""
    with patch("routers.terminal._pty_session", new_callable=AsyncMock) as mock_pty:
        with client.websocket_connect("/ws/terminal?workspace_root=/nonexistent/path/12345") as ws:
            assert ws is not None

        mock_pty.assert_called_once()
        # Verify the path passed was not the nonexistent one
        passed_root = mock_pty.call_args[0][1]
        assert passed_root != "/nonexistent/path/12345"
