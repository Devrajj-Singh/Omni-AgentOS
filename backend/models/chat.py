"""Chat request and response models."""
from typing import Literal
import uuid

from pydantic import BaseModel, Field

from .message import Message


class ChatRequest(BaseModel):
    """Chat request model for initiating a streaming chat turn."""

    session_id: str = Field(..., min_length=1, description="Session identifier")
    message: str = Field(..., min_length=1, description="User message content")
    conversation_history: list[Message] = Field(
        default_factory=list,
        description="Previous messages in the conversation"
    )
    workspace_path: str | None = Field(
        default=None,
        description="Active workspace root for tool sandboxing"
    )
    active_file_path: str | None = Field(
        default=None,
        description="Currently open file in developer mode"
    )
    autonomous_mode: bool = Field(
        default=False,
        description="Skip human approvals for write and command tools"
    )
    recently_opened_files: list[str] = Field(
        default_factory=list,
        description="Recently active developer-mode files"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "message": "Hello, how are you?",
                "conversation_history": [],
                "workspace_path": None,
                "active_file_path": None,
                "autonomous_mode": False,
                "recently_opened_files": []
            }
        }


class ChatResponse(BaseModel):
    """Chat response model returned immediately after request."""

    task_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique task identifier for this chat turn"
    )
    status: Literal["streaming"] = Field(
        default="streaming",
        description="Status of the chat task"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "task_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "streaming"
            }
        }
