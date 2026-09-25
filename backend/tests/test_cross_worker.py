"""Test cross-worker simulation for Redis-backed approval and websocket relay."""
import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

from execution.approval_store import ApprovalDecision, ApprovalStore
from websocket.manager import ConnectionManager
from models.ws_event import WSEvent, WSEventType


@pytest.mark.asyncio
async def test_cross_worker_approval_resolution():
    """Worker 1 creates and waits; Worker 2 resolves."""
    worker1_store = ApprovalStore()
    worker2_store = ApprovalStore()

    approval_id = await worker1_store.create(
        tool="write_file_tool",
        args={"path": "cross_worker.txt", "content": "multi-worker test"},
        description="Write cross_worker.txt",
    )

    async def worker2_resolves():
        await asyncio.sleep(0.3)
        # Worker 2 resolves the approval created by Worker 1
        success = await worker2_store.resolve(approval_id, ApprovalDecision.APPROVED)
        assert success is True

    worker2_task = asyncio.create_task(worker2_resolves())

    # Worker 1 was waiting
    decision = await worker1_store.wait_for_decision(approval_id, timeout=5.0)
    await worker2_task

    assert decision == ApprovalDecision.APPROVED
    data = await worker1_store.get(approval_id)
    assert data["decision"] == "approved"


@pytest.mark.asyncio
async def test_cross_worker_websocket_event_delivery():
    """Worker 1 holds the client WebSocket; Worker 2 sends an event to that session."""
    worker1_manager = ConnectionManager()
    worker2_manager = ConnectionManager()

    session_id = "test-session-cross-worker-999"
    mock_ws = MagicMock()
    mock_ws.accept = AsyncMock()
    mock_ws.send_text = AsyncMock()

    # Worker 1 connects the client
    await worker1_manager.connect(session_id, mock_ws)
    await asyncio.sleep(0.1)

    try:
        # Worker 2 emits an event for session_id (which it has NO local connection for)
        assert session_id not in worker2_manager._connections

        event = WSEvent(
            type=WSEventType.TOKEN,
            task_id="task-multi-worker",
            payload={"text": "Delivered across workers via Redis"},
            timestamp=datetime.utcnow(),
        )

        await worker2_manager.send_event(session_id, event)
        await asyncio.sleep(0.2)

        # Worker 1's socket should have received the message via Redis relay!
        mock_ws.send_text.assert_called_once()
        raw = mock_ws.send_text.call_args[0][0]
        parsed = json.loads(raw)
        assert parsed["type"] == "token"
        assert parsed["payload"]["text"] == "Delivered across workers via Redis"
    finally:
        await worker1_manager.disconnect(session_id)
