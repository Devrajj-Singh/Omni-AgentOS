"""Memory API endpoints for searching, listing, and deleting memories."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from memory.store import memory_store

router = APIRouter()


class MemoryItem(BaseModel):
    id: str
    user_message: str
    assistant_message: str
    timestamp: str
    session_id: str
    workspace_path: str
    relevance: float = 0.0


class MemorySearchResponse(BaseModel):
    results: list[MemoryItem]
    total: int


class MemoryListResponse(BaseModel):
    memories: list[MemoryItem]
    total: int
    count: int


def _to_memory_item(mem: dict, relevance: float = 0.0) -> MemoryItem:
    meta = mem.get("metadata", {})
    return MemoryItem(
        id=mem["id"],
        user_message=meta.get("user_message", ""),
        assistant_message=meta.get("assistant_message", ""),
        timestamp=meta.get("timestamp", ""),
        session_id=meta.get("session_id", ""),
        workspace_path=meta.get("workspace_path", ""),
        relevance=mem.get("relevance", relevance),
    )


@router.get("/memory/search", response_model=MemorySearchResponse)
async def search_memories(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=10, ge=1, le=50),
) -> MemorySearchResponse:
    """Semantic search over stored memories."""
    results = memory_store.search(query=q, n_results=limit)
    items = [_to_memory_item(memory) for memory in results]
    return MemorySearchResponse(results=items, total=len(items))


@router.get("/memory", response_model=MemoryListResponse)
async def list_memories(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> MemoryListResponse:
    """List all stored memories, newest first."""
    memories = memory_store.get_all(limit=limit, offset=offset)
    items = [_to_memory_item(memory) for memory in memories]
    return MemoryListResponse(
        memories=items,
        total=memory_store.count(),
        count=len(items),
    )


@router.delete("/memory/{memory_id}")
async def delete_memory(memory_id: str) -> dict:
    """Delete a memory by ID."""
    success = memory_store.delete(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"deleted": memory_id}


@router.get("/memory/stats")
async def memory_stats() -> dict:
    """Return memory system statistics."""
    return {
        "total_memories": memory_store.count(),
        "status": "active",
    }
