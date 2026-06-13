"""Task models for AI work units."""
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """Task status enumeration."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    ERROR = "error"


class ToolCall(BaseModel):
    """Tool call model representing a single tool invocation."""

    id: str = Field(..., description="Unique tool call identifier")
    name: str = Field(..., description="Tool name")
    input: dict[str, Any] = Field(..., description="Tool input parameters")
    output: dict[str, Any] | None = Field(None, description="Tool output result")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "tool-123",
                "name": "search",
                "input": {"query": "Python FastAPI"},
                "output": {"results": ["result1", "result2"]},
            }
        }


class Task(BaseModel):
    """Task model representing a unit of AI work."""

    id: str = Field(..., description="Unique task identifier")
    status: TaskStatus = Field(..., description="Current task status")
    plan: list[str] = Field(default_factory=list, description="Task execution plan steps")
    tool_calls: list[ToolCall] = Field(
        default_factory=list, description="Tool calls made during task execution"
    )
    result: str | None = Field(None, description="Task execution result")
    created_at: datetime = Field(
        default_factory=datetime.utcnow, description="Task creation timestamp"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "id": "task-123",
                "status": "running",
                "plan": ["Step 1: Analyze", "Step 2: Execute"],
                "tool_calls": [],
                "result": None,
                "created_at": "2024-01-01T12:00:00Z",
            }
        }
