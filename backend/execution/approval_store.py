"""Redis-backed store for pending human approvals with seamless in-memory fallback.

Approval state lives in memory AND in Redis (if available), so single-worker and
local development works without external dependencies, while multi-worker
setups can resolve approvals across workers.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
import uuid
from enum import Enum
from typing import Any

from dependencies.redis_client import get_redis_client

logger = logging.getLogger(__name__)

APPROVAL_TTL_SECONDS = 60


class ApprovalDecision(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "timeout"


class ApprovalStore:
    """Hybrid Redis and in-memory store for pending approvals."""

    _shared_in_memory: dict[str, dict[str, Any]] = {}
    _shared_events: dict[str, asyncio.Event] = {}

    def __init__(self) -> None:
        self._in_memory = ApprovalStore._shared_in_memory
        self._events = ApprovalStore._shared_events

    def _key(self, approval_id: str) -> str:
        return f"approval:{approval_id}"

    def _channel(self, approval_id: str) -> str:
        return f"approval:resolved:{approval_id}"

    async def create(
        self,
        tool: str,
        args: dict[str, Any],
        description: str,
        risk_level: str = "medium",
    ) -> str:
        """Create a pending approval. Returns the new approval_id."""
        approval_id = str(uuid.uuid4())
        payload = {
            "approval_id": approval_id,
            "tool": tool,
            "args": args,
            "description": description,
            "risk_level": risk_level,
            "decision": None,
            "created_at": time.time(),
        }
        # In-memory storage
        self._in_memory[approval_id] = payload
        self._events[approval_id] = asyncio.Event()

        # Redis storage if available (non-blocking failure)
        try:
            redis_client = get_redis_client()
            await redis_client.set(
                self._key(approval_id), json.dumps(payload), ex=APPROVAL_TTL_SECONDS
            )
        except Exception as e:
            logger.debug(f"Redis unavailable for approval {approval_id}: {e}")

        return approval_id

    async def get(self, approval_id: str) -> dict[str, Any] | None:
        if approval_id in self._in_memory:
            return self._in_memory[approval_id]
        try:
            redis_client = get_redis_client()
            raw = await redis_client.get(self._key(approval_id))
            return json.loads(raw) if raw else None
        except Exception:
            return None

    async def resolve(self, approval_id: str, decision: ApprovalDecision) -> bool:
        """Resolve a pending approval. Returns True if found and newly resolved."""
        found = False
        if approval_id in self._in_memory:
            data = self._in_memory[approval_id]
            if data.get("decision") is None:
                data["decision"] = decision.value
                event = self._events.get(approval_id)
                if event:
                    event.set()
                found = True

        try:
            redis_client = get_redis_client()
            data = await self.get(approval_id)
            if data and data.get("decision") is None:
                data["decision"] = decision.value
                await redis_client.set(
                    self._key(approval_id), json.dumps(data), ex=APPROVAL_TTL_SECONDS
                )
                await redis_client.publish(self._channel(approval_id), decision.value)
                found = True
        except Exception as e:
            logger.debug(f"Redis unavailable for resolve {approval_id}: {e}")

        return found

    async def wait_for_decision(self, approval_id: str, timeout: float) -> ApprovalDecision:
        """
        Block (async) until this approval is resolved in-memory or via Redis, or until timeout.
        """
        # Fast path
        existing = await self.get(approval_id)
        if existing and existing.get("decision"):
            return ApprovalDecision(existing["decision"])

        event = self._events.get(approval_id)

        async def _wait_event() -> ApprovalDecision | None:
            if event:
                await event.wait()
                curr = await self.get(approval_id)
                if curr and curr.get("decision"):
                    return ApprovalDecision(curr["decision"])
            return None

        async def _wait_redis() -> ApprovalDecision | None:
            try:
                redis_client = get_redis_client()
                pubsub = redis_client.pubsub()
                channel = self._channel(approval_id)
                await pubsub.subscribe(channel)
                try:
                    async for message in pubsub.listen():
                        if message.get("type") == "message":
                            return ApprovalDecision(message["data"])
                finally:
                    with contextlib.suppress(Exception):
                        await pubsub.unsubscribe(channel)
                        await pubsub.aclose()
            except Exception:
                await asyncio.sleep(timeout + 5)
                return None

        try:
            async with asyncio.timeout(timeout):
                t_event = asyncio.create_task(_wait_event())
                t_redis = asyncio.create_task(_wait_redis())
                done, pending = await asyncio.wait(
                    [t_event, t_redis], return_when=asyncio.FIRST_COMPLETED
                )
                for p in pending:
                    p.cancel()
                for d in done:
                    res = d.result()
                    if res:
                        return res
        except (TimeoutError, asyncio.TimeoutError):
            await self.resolve(approval_id, ApprovalDecision.TIMEOUT)
            return ApprovalDecision.TIMEOUT

        return ApprovalDecision.TIMEOUT

    async def cancel_all(self) -> None:
        """Resolve every still-pending approval as TIMEOUT."""
        for aid in list(self._in_memory.keys()):
            if self._in_memory[aid].get("decision") is None:
                await self.resolve(aid, ApprovalDecision.TIMEOUT)
        try:
            redis_client = get_redis_client()
            async for key in redis_client.scan_iter(match="approval:*"):
                raw = await redis_client.get(key)
                if not raw:
                    continue
                data = json.loads(raw)
                if data.get("decision") is None:
                    await self.resolve(data["approval_id"], ApprovalDecision.TIMEOUT)
        except Exception:
            pass


approval_store = ApprovalStore()
