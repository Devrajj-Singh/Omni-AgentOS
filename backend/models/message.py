"""Message models for chat interface."""
from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, Field


class Message(BaseModel):
    """Chat message model."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: Literal["user", "assistant", "system"]
    content: str
    is_streaming: bool = False
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
