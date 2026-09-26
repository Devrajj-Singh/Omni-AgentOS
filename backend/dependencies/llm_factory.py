"""LLM Factory for Omni AgentOS.

Provides centralized, provider-agnostic construction of LangChain chat models
supporting BYO API keys (passed per request or set in settings).
"""
from __future__ import annotations

import os
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_groq import ChatGroq

from configs.settings import AVAILABLE_MODELS, app_settings


def resolve_api_key(api_key: str | None = None, provider: str = "Groq") -> str:
    """Resolve API key using priority order:

    1. Explicit request-level key (from X-API-Key header)
    2. In-memory user_api_key on app_settings
    3. Provider-specific environment variable (GROQ_API_KEY, OPENAI_API_KEY, etc.)
    """
    if api_key and api_key.strip():
        return api_key.strip()

    if app_settings.user_api_key and app_settings.user_api_key.strip():
        return app_settings.user_api_key.strip()

    if provider.lower() == "openai":
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key:
            return openai_key

    return os.getenv("GROQ_API_KEY", "")


def build_llm(
    model_id: str | None = None,
    api_key: str | None = None,
    *,
    streaming: bool = False,
    temperature: float = 0,
) -> BaseChatModel:
    """Construct and return a LangChain BaseChatModel instance.

    Routes to appropriate client (ChatGroq, ChatOpenAI, etc.) based on
    the model's provider and available API keys.
    """
    target_model_id = model_id or app_settings.active_model
    model_info = next(
        (m for m in AVAILABLE_MODELS if m["id"] == target_model_id),
        None,
    )
    provider = model_info.get("provider", "Groq") if model_info else "Groq"

    resolved_key = resolve_api_key(api_key, provider=provider)

    # Check if this is an explicit OpenAI provider model with an OpenAI key and library available
    if provider.lower() == "openai" and resolved_key.startswith("sk-"):
        try:
            from langchain_openai import ChatOpenAI  # type: ignore[import-not-found]

            return ChatOpenAI(
                api_key=resolved_key,
                model=target_model_id,
                temperature=temperature,
                streaming=streaming,
            )
        except ImportError:
            pass

    # Default to ChatGroq (supports Groq models as well as Groq-hosted open weights like openai/gpt-oss-120b)
    return ChatGroq(
        api_key=resolved_key,
        model=target_model_id,
        temperature=temperature,
        streaming=streaming,
    )
