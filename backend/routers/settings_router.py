"""Settings API endpoints."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from configs.settings import AVAILABLE_MODELS, app_settings
from memory.store import memory_store

router = APIRouter()


class ModelUpdateRequest(BaseModel):
    model_id: str


class SettingsResponse(BaseModel):
    active_model: str
    available_models: list[dict]
    memory_count: int
    max_file_size_kb: int
    excluded_dirs: list[str]


class ModelUpdateResponse(BaseModel):
    active_model: str
    message: str


@router.get("/settings", response_model=SettingsResponse)
async def get_settings() -> SettingsResponse:
    """Return current application settings."""
    return SettingsResponse(
        active_model=app_settings.active_model,
        available_models=AVAILABLE_MODELS,
        memory_count=memory_store.count(),
        max_file_size_kb=app_settings.max_file_size_kb,
        excluded_dirs=app_settings.excluded_dirs,
    )


@router.patch("/settings/model", response_model=ModelUpdateResponse)
async def update_model(request: ModelUpdateRequest) -> ModelUpdateResponse:
    """Update the active AI model. Takes effect on the next chat message."""
    valid_ids = [model["id"] for model in AVAILABLE_MODELS]
    if request.model_id not in valid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model ID. Choose from: {', '.join(valid_ids)}",
        )

    app_settings.active_model = request.model_id
    return ModelUpdateResponse(
        active_model=app_settings.active_model,
        message=f"Model updated to {request.model_id}. Takes effect on next message.",
    )


@router.delete("/settings/memory/all")
async def clear_all_memories() -> dict:
    """Delete all stored memories."""
    all_memories = memory_store.get_all(limit=1000)
    deleted_count = 0
    for memory in all_memories:
        if memory_store.delete(memory["id"]):
            deleted_count += 1
    return {"deleted": deleted_count, "message": f"Cleared {deleted_count} memories"}


@router.get("/settings/memory/export")
async def export_memories() -> dict:
    """Export all memories as JSON."""
    all_memories = memory_store.get_all(limit=1000)
    export_data = []
    for memory in all_memories:
        meta = memory.get("metadata", {})
        export_data.append(
            {
                "id": memory["id"],
                "user_message": meta.get("user_message", ""),
                "assistant_message": meta.get("assistant_message", ""),
                "timestamp": meta.get("timestamp", ""),
                "session_id": meta.get("session_id", ""),
                "workspace_path": meta.get("workspace_path", ""),
            }
        )

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "total": len(export_data),
        "memories": export_data,
    }
