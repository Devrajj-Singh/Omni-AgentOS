"""Redis-backed store for pending human approvals.

Approval state lives in Redis instead of process memory, so any backend
worker can resolve an approval that a different worker is blocked waiting
on - this is the fix for the single-process asyncio.Future limitation.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from enum import Enum
from typing import Any

from dependencies.redis_client import get_redis_client

APPROVAL_TTL_SECONDS = 60


class ApprovalDecision(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "timeout"


class ApprovalStore:
    """Redis-backed store for pending approvals. All methods are async."""

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
        """Create a pending approval in Redis. Returns the new approval_id."""
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
        redis_client = get_redis_client()
        await redis_client.set(
            self._key(approval_id), json.dumps(payload), ex=APPROVAL_TTL_SECONDS
        )
        return approval_id

    async def get(self, approval_id: str) -> dict[str, Any] | None:
        redis_client = get_redis_client()
        raw = await redis_client.get(self._key(approval_id))
        return json.loads(raw) if raw else None

    async def resolve(self, approval_id: str, decision: ApprovalDecision) -> bool:
        """Resolve a pending approval. Returns True if found and newly resolved."""
        redis_client = get_redis_client()
        data = await self.get(approval_id)
        if data is None:
            return False
        if data.get("decision") is not None:
            return False

        data["decision"] = decision.value
        await redis_client.set(
            self._key(approval_id), json.dumps(data), ex=APPROVAL_TTL_SECONDS
        )
        await redis_client.publish(self._channel(approval_id), decision.value)
        return True

    async def wait_for_decision(self, approval_id: str, timeout: float) -> ApprovalDecision:
        """
        Block (async) until this approval is resolved by ANY backend worker,
        or until timeout. On timeout, resolves it to TIMEOUT itself so a
        late-arriving HTTP request sees it's already closed instead of
        getting a confusing 404 against a request that technically still
        exists but is abandoned.
        """
        redis_client = get_redis_client()
        pubsub = redis_client.pubsub()
        channel = self._channel(approval_id)
        await pubsub.subscribe(channel)
        try:
            # Race guard: the decision may have landed between create()
            # and this subscribe() call.
            existing = await self.get(approval_id)
            if existing and existing.get("decision"):
                return ApprovalDecision(existing["decision"])

            async with asyncio.timeout(timeout):
                async for message in pubsub.listen():
                    if message.get("type") == "message":
                        return ApprovalDecision(message["data"])
        except (TimeoutError, asyncio.TimeoutError):
            await self.resolve(approval_id, ApprovalDecision.TIMEOUT)
            return ApprovalDecision.TIMEOUT
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
        return ApprovalDecision.TIMEOUT

    async def cancel_all(self) -> None:
        """Resolve every still-pending approval as TIMEOUT. Cleanup utility."""
        redis_client = get_redis_client()
        async for key in redis_client.scan_iter(match="approval:*"):
            raw = await redis_client.get(key)
            if not raw:
                continue
            data = json.loads(raw)
            if data.get("decision") is None:
                await self.resolve(data["approval_id"], ApprovalDecision.TIMEOUT)


approval_store = ApprovalStore()
