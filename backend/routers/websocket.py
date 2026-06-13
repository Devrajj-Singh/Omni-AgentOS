"""WebSocket endpoint for real-time communication."""
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from websocket.manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str) -> None:
    """
    WebSocket endpoint for real-time event streaming.

    Phase 1: Connects to ConnectionManager and keeps connection alive.

    Args:
        websocket: WebSocket connection
        session_id: Unique session identifier

    Behavior:
        - Registers connection with ConnectionManager
        - Keeps connection alive by receiving messages
        - Disconnects from ConnectionManager on close
    """
    await manager.connect(session_id, websocket)
    
    try:
        while True:
            # Keep connection alive by receiving messages
            # In Phase 1, we don't process incoming messages from the client
            # The backend sends events via manager.send_event()
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: session_id=%s", session_id)
    finally:
        await manager.disconnect(session_id)
