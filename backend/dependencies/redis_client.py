"""Shared async Redis client singleton."""
from __future__ import annotations

import asyncio
import os

import redis.asyncio as redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6380")

_redis_client: redis.Redis | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


def get_redis_client() -> redis.Redis:
    """Return the shared async Redis client, creating it on first use."""
    global _redis_client, _client_loop
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _redis_client is None or (_client_loop is not None and _client_loop != current_loop):
        _redis_client = redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1.0,
            socket_timeout=1.0,
        )
        _client_loop = current_loop
    return _redis_client


async def is_redis_online() -> bool:
    """Check if Redis server is reachable."""
    try:
        client = get_redis_client()
        async with asyncio.timeout(1.0):
            return bool(await client.ping())
    except Exception:
        return False


async def close_redis_client() -> None:
    """Close the Redis client. Call this on application shutdown."""
    global _redis_client, _client_loop
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
        except Exception:
            pass
        _redis_client = None
        _client_loop = None

