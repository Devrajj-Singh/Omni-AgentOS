"""Observability endpoints - read-only access to the structured event buffer."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from observability.logger import get_events_for_task, get_recent_events, get_task_ids

router = APIRouter()


class EventsResponse(BaseModel):
    events: list[dict]
    total: int


class TaskListResponse(BaseModel):
    task_ids: list[str]


@router.get("/observability/events", response_model=EventsResponse)
async def list_events(limit: int = 200) -> EventsResponse:
    """Return the most recent structured events across all tasks."""
    events = get_recent_events(limit=limit)
    return EventsResponse(events=events, total=len(events))


@router.get("/observability/tasks", response_model=TaskListResponse)
async def list_tasks(limit: int = 50) -> TaskListResponse:
    """Return distinct task_ids seen recently, most recent first."""
    return TaskListResponse(task_ids=get_task_ids(limit=limit))


@router.get("/observability/tasks/{task_id}", response_model=EventsResponse)
async def get_task_events(task_id: str) -> EventsResponse:
    """Return all events for a specific task, in chronological order."""
    events = get_events_for_task(task_id)
    return EventsResponse(events=events, total=len(events))
