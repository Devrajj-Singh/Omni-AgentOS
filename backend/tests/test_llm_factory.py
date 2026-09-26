"""Unit tests for LLM factory and BYO API key routing."""
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from configs.settings import app_settings
from dependencies.llm_factory import build_llm, resolve_api_key
from main import app


def test_resolve_api_key_explicit_priority():
    app_settings.user_api_key = "settings_key"
    with patch.dict("os.environ", {"GROQ_API_KEY": "env_key"}):
        assert resolve_api_key("custom_request_key") == "custom_request_key"
    app_settings.user_api_key = None


def test_resolve_api_key_settings_priority():
    app_settings.user_api_key = "settings_key"
    with patch.dict("os.environ", {"GROQ_API_KEY": "env_key"}):
        assert resolve_api_key("") == "settings_key"
        assert resolve_api_key(None) == "settings_key"
    app_settings.user_api_key = None


def test_resolve_api_key_env_fallback():
    app_settings.user_api_key = None
    with patch.dict("os.environ", {"GROQ_API_KEY": "env_key"}):
        assert resolve_api_key(None) == "env_key"


def test_build_llm_creates_model_with_api_key():
    with patch("dependencies.llm_factory.ChatGroq") as mock_groq:
        build_llm(model_id="llama-3.1-8b-instant", api_key="custom_byo_key", streaming=True)
        mock_groq.assert_called_once_with(
            api_key="custom_byo_key",
            model="llama-3.1-8b-instant",
            temperature=0,
            streaming=True,
        )


def test_settings_api_key_endpoints():
    client = TestClient(app)

    # Set key
    res = client.post("/api/v1/settings/api-key", json={"api_key": "my_new_key"})
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "has_user_api_key": True}
    assert app_settings.user_api_key == "my_new_key"

    # Settings response shows has_user_api_key=True without exposing the raw key
    res = client.get("/api/v1/settings")
    assert res.status_code == 200
    data = res.json()
    assert data["has_user_api_key"] is True
    assert "my_new_key" not in str(data)

    # Clear key
    res = client.delete("/api/v1/settings/api-key")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "has_user_api_key": False}
    assert app_settings.user_api_key is None


def test_chat_endpoint_accepts_x_api_key_header():
    client = TestClient(app)
    with patch("routers.chat.orchestrate_streaming", new_callable=AsyncMock) as mock_streaming:
        res = client.post(
            "/api/v1/chat",
            json={
                "session_id": "test-session",
                "message": "Hello",
                "conversation_history": [],
            },
            headers={"X-API-Key": "gsk_request_specific_key"},
        )
        assert res.status_code == 202
        assert res.json()["status"] == "streaming"
        # Verify background task received the api_key
        mock_streaming.assert_called_once()
        _, kwargs = mock_streaming.call_args
        assert kwargs.get("api_key") == "gsk_request_specific_key"
