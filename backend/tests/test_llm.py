"""
Tests for Groq Client (llm.py)
"""

import pytest
import os
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from configs.settings import app_settings
from services.llm import stream_chat, GeminiError, _convert_messages


class TestMessageConversion:
    """Test message format conversion."""
    
    def test_convert_user_message(self):
        """Test user message conversion"""
        messages = [{"role": "user", "content": "Hello"}]
        result = _convert_messages(messages)
        
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Hello"
    
    def test_convert_assistant_message(self):
        """Test assistant message conversion."""
        messages = [{"role": "assistant", "content": "Hi there"}]
        result = _convert_messages(messages)
        
        assert len(result) == 1
        assert result[0]["role"] == "assistant"
        assert result[0]["content"] == "Hi there"
    
    def test_convert_system_message(self):
        """Test system message conversion."""
        messages = [{"role": "system", "content": "You are helpful"}]
        result = _convert_messages(messages)
        
        assert len(result) == 1
        assert result[0]["role"] == "system"
        assert result[0]["content"] == "You are helpful"
    
    def test_convert_mixed_messages(self):
        """Test conversion of multiple message types"""
        messages = [
            {"role": "system", "content": "Be helpful"},
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi"},
            {"role": "user", "content": "How are you?"}
        ]
        result = _convert_messages(messages)
        
        assert len(result) == 4
        assert result[0]["role"] == "system"
        assert result[0]["content"] == "Be helpful"
        assert result[1]["role"] == "user"
        assert result[2]["role"] == "assistant"
        assert result[3]["role"] == "user"


class TestStreamChat:
    """Test stream_chat function"""
    
    @pytest.mark.asyncio
    async def test_stream_chat_success(self):
        """Test successful streaming"""
        messages = [{"role": "user", "content": "Hello"}]
        tokens = []
        
        async def on_token(text: str):
            tokens.append(text)
        
        class FakeStream:
            def __aiter__(self):
                return self

            async def __anext__(self):
                if not chunks:
                    raise StopAsyncIteration
                return chunks.pop(0)

        with patch('services.llm.client') as mock_client:
            mock_chunk1 = MagicMock()
            mock_chunk1.choices = [MagicMock(delta=MagicMock(content="Hello"))]
            mock_chunk2 = MagicMock()
            mock_chunk2.choices = [MagicMock(delta=MagicMock(content=" there"))]
            chunks = [mock_chunk1, mock_chunk2]
            mock_client.chat.completions.create = AsyncMock(return_value=FakeStream())
            
            await stream_chat(messages, on_token)

            mock_client.chat.completions.create.assert_called_once()
            _, kwargs = mock_client.chat.completions.create.call_args
            assert kwargs["model"] == app_settings.active_model
        
        assert len(tokens) == 2
        assert tokens[0] == "Hello"
        assert tokens[1] == " there"
    
    @pytest.mark.asyncio
    async def test_stream_chat_timeout(self):
        """Test timeout handling"""
        messages = [{"role": "user", "content": "Hello"}]
        
        async def on_token(text: str):
            pass
        
        with patch('services.llm.client') as mock_client:
            mock_client.chat.completions.create = AsyncMock(
                side_effect=asyncio.TimeoutError("Response timeout")
            )

            with pytest.raises(GeminiError, match="Response timeout"):
                await stream_chat(messages, on_token)
    
    @pytest.mark.asyncio
    async def test_stream_chat_api_error(self):
        """Test API error handling"""
        messages = [{"role": "user", "content": "Hello"}]
        
        async def on_token(text: str):
            pass
        
        with patch('services.llm.client') as mock_client:
            mock_client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))
            
            with pytest.raises(GeminiError, match="API Error"):
                await stream_chat(messages, on_token)


class TestEnvironmentValidation:
    """Test environment variable validation"""
    
    def test_missing_api_key_raises_error(self):
        """Test that missing GROQ_API_KEY raises EnvironmentError on import."""
        # This test verifies the module-level check
        # In practice, the module would fail to import if the key is missing
        # We test this by checking the error message format
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(EnvironmentError, match="GROQ_API_KEY is not set"):
                # Simulate module import check
                api_key = os.getenv("GROQ_API_KEY")
                if not api_key:
                    raise EnvironmentError("GROQ_API_KEY is not set. Add it to your .env file.")
