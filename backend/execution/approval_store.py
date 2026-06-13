"""In-memory store for pending human approvals."""
from __future__ import annotations

import asyncio
import threading
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ApprovalDecision(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "timeout"


@dataclass
class ApprovalRequest:
    approval_id: str
    tool: str
    args: dict[str, Any]
    description: str
    risk_level: str
    loop: asyncio.AbstractEventLoop = field(repr=False)
    future: asyncio.Future[ApprovalDecision] = field(repr=False)


class ApprovalStore:
    """Thread-safe in-memory store for pending approvals."""

    def __init__(self) -> None:
        self._pending: dict[str, ApprovalRequest] = {}
        self._lock = threading.Lock()

    def create(
        self,
        tool: str,
        args: dict[str, Any],
        description: str,
        risk_level: str = "medium",
        loop: asyncio.AbstractEventLoop | None = None,
    ) -> ApprovalRequest:
        approval_id = str(uuid.uuid4())
        event_loop = loop or asyncio.get_event_loop()
        request = ApprovalRequest(
            approval_id=approval_id,
            tool=tool,
            args=args,
            description=description,
            risk_level=risk_level,
            loop=event_loop,
            future=event_loop.create_future(),
        )
        with self._lock:
            self._pending[approval_id] = request
        return request

    def resolve(self, approval_id: str, decision: ApprovalDecision) -> bool:
        """Resolve a pending approval. Returns True if found and resolved."""
        with self._lock:
            request = self._pending.pop(approval_id, None)

        if request is None:
            return False
        if not request.future.done():
            request.loop.call_soon_threadsafe(request.future.set_result, decision)
        return True

    def cancel_all(self, session_id_prefix: str = "") -> None:
        """Cancel all pending approvals."""
        with self._lock:
            pending = list(self._pending.values())
            self._pending.clear()

        for request in pending:
            if not request.future.done():
                request.loop.call_soon_threadsafe(request.future.set_result, ApprovalDecision.TIMEOUT)

    def get(self, approval_id: str) -> ApprovalRequest | None:
        with self._lock:
            return self._pending.get(approval_id)


approval_store = ApprovalStore()
