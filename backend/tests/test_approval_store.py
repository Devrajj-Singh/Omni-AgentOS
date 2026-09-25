"""Unit and integration tests for Redis-backed ApprovalStore."""
import asyncio
import pytest

from execution.approval_store import ApprovalDecision, approval_store


@pytest.mark.asyncio
async def test_approval_store_create_and_get():
    approval_id = await approval_store.create(
        tool="write_file_tool",
        args={"path": "test.txt", "content": "hello"},
        description="Write hello to test.txt",
        risk_level="medium",
    )
    assert approval_id is not None
    data = await approval_store.get(approval_id)
    assert data is not None
    assert data["approval_id"] == approval_id
    assert data["tool"] == "write_file_tool"
    assert data["args"]["path"] == "test.txt"
    assert data["decision"] is None


@pytest.mark.asyncio
async def test_approval_store_resolve():
    approval_id = await approval_store.create(
        tool="run_command_tool",
        args={"command": "ls"},
        description="Run ls",
        risk_level="low",
    )
    resolved = await approval_store.resolve(approval_id, ApprovalDecision.APPROVED)
    assert resolved is True

    # Resolving again should return False
    resolved_again = await approval_store.resolve(approval_id, ApprovalDecision.REJECTED)
    assert resolved_again is False

    data = await approval_store.get(approval_id)
    assert data is not None
    assert data["decision"] == "approved"


@pytest.mark.asyncio
async def test_approval_store_wait_for_decision():
    approval_id = await approval_store.create(
        tool="write_file_tool",
        args={"path": "doc.txt"},
        description="Write doc.txt",
    )

    async def resolve_later():
        await asyncio.sleep(0.2)
        await approval_store.resolve(approval_id, ApprovalDecision.APPROVED)

    resolve_task = asyncio.create_task(resolve_later())
    decision = await approval_store.wait_for_decision(approval_id, timeout=3.0)
    await resolve_task

    assert decision == ApprovalDecision.APPROVED
    data = await approval_store.get(approval_id)
    assert data["decision"] == "approved"


@pytest.mark.asyncio
async def test_approval_store_timeout():
    approval_id = await approval_store.create(
        tool="write_file_tool",
        args={"path": "timeout.txt"},
        description="Write timeout.txt",
    )
    decision = await approval_store.wait_for_decision(approval_id, timeout=0.3)
    assert decision == ApprovalDecision.TIMEOUT

    data = await approval_store.get(approval_id)
    assert data["decision"] == "timeout"
