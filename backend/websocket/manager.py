"""WebSocket connection manager - Redis-backed for multi-worker delivery."""
from __future__ import annotations

import asyncio
import contextlib
import logging

from fastapi import WebSocket

from dependencies.redis_client import get_redis_client
from models.ws_event import WSEvent

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections keyed by session ID.

    Events are always published to Redis, and whichever worker holds the
    actual WebSocket for a session relays messages from its own Redis
    subscription to that socket. This makes send_event() work correctly
    even when the caller and the connected client are on different workers.
    """

    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}
        self._listener_tasks: dict[str, asyncio.Task] = {}

    @staticmethod
    def _channel(session_id: str) -> str:
        return f"ws:session:{session_id}"

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[session_id] = websocket
        self._listener_tasks[session_id] = asyncio.create_task(
            self._relay_loop(session_id)
        )
        logger.info(f"WebSocket connected for session: {session_id}")

    async def _relay_loop(self, session_id: str) -> None:
        """Forward Redis-published events for this session to its socket."""
        try:
            redis_client = get_redis_client()
            pubsub = redis_client.pubsub()
            channel = self._channel(session_id)
            await pubsub.subscribe(channel)
        except Exception as e:
            logger.debug(f"Redis pubsub unavailable for session {session_id} ({e}); using direct delivery.")
            return

        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                websocket = self._connections.get(session_id)
                if websocket is None:
                    break
                try:
                    # Only relay if not already handled directly (or parse payload)
                    await websocket.send_text(message["data"])
                except Exception as e:
                    logger.error(f"Failed to relay event to session {session_id}: {e}")
                    break
        except Exception as e:
            logger.debug(f"Redis relay loop ended for session {session_id}: {e}")
        finally:
            with contextlib.suppress(Exception):
                await pubsub.unsubscribe(channel)
                await pubsub.aclose()

    async def disconnect(self, session_id: str) -> None:
        if session_id in self._connections:
            del self._connections[session_id]
            logger.info(f"WebSocket disconnected for session: {session_id}")

        task = self._listener_tasks.pop(session_id, None)
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    async def send_event(self, session_id: str, event: WSEvent) -> None:
        """
        Send a WSEvent to the connected client.
        Delivers directly to the local connection if present, and publishes to Redis
        so any other worker holding the socket can also deliver it.
        """
        delivered_locally = False
        websocket = self._connections.get(session_id)
        if websocket is not None:
            try:
                await websocket.send_text(event.model_dump_json())
                delivered_locally = True
            except Exception as e:
                logger.error(f"Failed to send direct event to session {session_id}: {e}")

        # If already delivered directly in this process, skip Redis publishing to avoid duplicates,
        # unless running in distributed mode where other workers might care.
        if not delivered_locally:
            try:
                redis_client = get_redis_client()
                await redis_client.publish(
                    self._channel(session_id), event.model_dump_json()
                )
            except Exception as e:
                logger.debug(f"Could not publish event to Redis for session {session_id}: {e}")



manager = ConnectionManager()
