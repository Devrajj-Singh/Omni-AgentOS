"""WebSocket connection manager."""
import logging
from fastapi import WebSocket

from models.ws_event import WSEvent

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections keyed by session ID."""

    def __init__(self):
        """Initialize the connection manager."""
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        """
        Register a new WebSocket connection.

        Args:
            session_id: Unique session identifier
            websocket: FastAPI WebSocket instance
        """
        await websocket.accept()
        self._connections[session_id] = websocket
        logger.info(f"WebSocket connected for session: {session_id}")

    async def disconnect(self, session_id: str) -> None:
        """
        Remove a WebSocket connection.

        Args:
            session_id: Unique session identifier
        """
        if session_id in self._connections:
            del self._connections[session_id]
            logger.info(f"WebSocket disconnected for session: {session_id}")

    async def send_event(self, session_id: str, event: WSEvent) -> None:
        """
        Send a WSEvent to a specific session.

        Args:
            session_id: Unique session identifier
            event: WSEvent to send

        Note:
            If the session is not connected, logs a warning and discards the event.
        """
        websocket = self._connections.get(session_id)
        if websocket is None:
            logger.warning(
                f"Attempted to send event to non-existent session: {session_id}. "
                f"Event type: {event.type}, task_id: {event.task_id}"
            )
            return

        try:
            # Convert Pydantic model to dict and send as JSON
            await websocket.send_json(event.model_dump(mode="json"))
        except Exception as e:
            logger.error(
                f"Failed to send event to session {session_id}: {e}. "
                f"Event type: {event.type}, task_id: {event.task_id}"
            )


# Module-level singleton instance
manager = ConnectionManager()
