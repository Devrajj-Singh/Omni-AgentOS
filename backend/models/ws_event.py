"""WebSocket event models."""
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class WSEventType(str, Enum):
    """WebSocket event type enumeration."""

    TOKEN = "token"
    AGENT_THINKING = "agent.thinking"
    AGENT_DONE = "agent.done"
    TOOL_CALL = "tool.call"
    TOOL_RESULT = "tool.result"
    APPROVAL_REQUIRED = "approval.required"
    APPROVAL_RESOLVED = "approval.resolved"
    TASK_START = "task.start"
    TASK_COMPLETE = "task.complete"
    ERROR = "error"


class WSEvent(BaseModel):
    """WebSocket event model."""

    type: WSEventType
    task_id: str = Field(..., description="Unique identifier for the task")
    agent_id: str | None = Field(None, description="Optional agent identifier")
    payload: dict[str, Any] = Field(default_factory=dict, description="Event payload data")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "type": "token",
                "task_id": "task-123",
                "agent_id": "planner",
                "payload": {"text": "Hello world"},
                "timestamp": "2024-01-01T12:00:00Z",
            }
        }
