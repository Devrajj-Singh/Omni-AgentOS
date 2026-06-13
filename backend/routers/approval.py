"""Approval endpoints for human-in-the-loop execution."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from execution.approval_store import ApprovalDecision, approval_store
from models.ws_event import WSEvent, WSEventType
from websocket.manager import manager

router = APIRouter()


class ApprovalDecisionRequest(BaseModel):
    session_id: str
    decision: str


@router.post("/approval/{approval_id}")
async def resolve_approval(
    approval_id: str,
    body: ApprovalDecisionRequest,
) -> dict[str, str]:
    """Resolve a pending approval request."""
    if body.decision not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'")

    decision = (
        ApprovalDecision.APPROVED
        if body.decision == "approved"
        else ApprovalDecision.REJECTED
    )

    resolved = approval_store.resolve(approval_id, decision)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail=f"Approval '{approval_id}' not found or already resolved.",
        )

    await manager.send_event(
        body.session_id,
        WSEvent(
            type=WSEventType.APPROVAL_RESOLVED,
            task_id=approval_id,
            payload={"approvalId": approval_id, "decision": body.decision},
            timestamp=datetime.utcnow(),
        ),
    )

    return {"approvalId": approval_id, "decision": body.decision}
