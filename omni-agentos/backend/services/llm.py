"""
Groq LLM client for Omni AgentOS.
Uses groq SDK with llama-3.1-8b-instant for fast streaming.
"""
import os
from collections.abc import Awaitable, Callable

from groq import AsyncGroq

from configs.settings import app_settings


class GeminiError(Exception):
    """Kept as LLMError for compatibility with existing error handling."""
    pass


GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise EnvironmentError("GROQ_API_KEY is not set. Add it to your .env file.")

client = AsyncGroq(api_key=GROQ_API_KEY)


def _convert_messages(messages: list) -> list[dict]:
    """Convert Message models to Groq format."""
    groq_messages = []
    for msg in messages:
        role = msg.get("role") if isinstance(msg, dict) else msg.role
        content = msg.get("content") if isinstance(msg, dict) else msg.content

        if role == "assistant":
            groq_messages.append({"role": "assistant", "content": content})
        elif role == "system":
            groq_messages.append({"role": "system", "content": content})
        else:
            groq_messages.append({"role": "user", "content": content})

    return groq_messages


async def stream_chat(
    messages: list,
    on_token: Callable[[str], Awaitable[None]],
) -> None:
    """
    Stream chat completion from Groq.

    Args:
        messages: Conversation history (Message models or dicts)
        on_token: Async callback invoked for each token chunk

    Raises:
        GeminiError: On API errors or timeout
    """
    try:
        groq_messages = _convert_messages(messages)

        stream = await client.chat.completions.create(
            model=app_settings.active_model,
            messages=groq_messages,
            stream=True,
            timeout=30,
        )

        async for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                await on_token(token)

    except Exception as e:
        raise GeminiError(str(e)) from e
