"""Web search tool using Tavily API."""
from __future__ import annotations

import os
from typing import Any

_raw_tavily_key = os.getenv("TAVILY_API_KEY", "")
TAVILY_API_KEY = "" if _raw_tavily_key == "your_tavily_key_here" else _raw_tavily_key
TAVILY_AVAILABLE = False

try:
    from tavily import TavilyClient

    TAVILY_AVAILABLE = True
except ModuleNotFoundError:
    TavilyClient = None  # type: ignore[assignment]

_client: Any | None = None


def _get_client() -> Any:
    global _client
    if _client is None:
        if not TAVILY_API_KEY:
            raise EnvironmentError("TAVILY_API_KEY is not set.")
        if not TAVILY_AVAILABLE or TavilyClient is None:
            raise ImportError("tavily-python is not installed.")
        _client = TavilyClient(api_key=TAVILY_API_KEY)
    return _client


def web_search(query: str, max_results: int = 5) -> str:
    """
    Search the web using Tavily and return formatted results.
    Returns results as a formatted string for the agent to use.
    """
    try:
        client = _get_client()
        response = client.search(
            query=query,
            max_results=max_results,
            search_depth="basic",
            include_answer=True,
        )

        parts = []

        if response.get("answer"):
            parts.append(f"Summary: {response['answer']}\n")

        results = response.get("results", [])
        for i, result in enumerate(results, 1):
            title = result.get("title", "No title")
            url = result.get("url", "")
            content = result.get("content", "")[:400]
            parts.append(f"[{i}] {title}\nURL: {url}\n{content}\n")

        return "\n".join(parts) if parts else "No results found."

    except Exception as e:
        return f"Web search error: {str(e)}"
