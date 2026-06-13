"""Session models for user connection management."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class Session(BaseModel):
    """User session model."""

    session_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), description="Unique session identifier"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow, description="Session creation timestamp"
    )
    metadata: dict[str, str] = Field(
        default_factory=dict, description="Optional session metadata"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "created_at": "2024-01-01T12:00:00Z",
                "metadata": {},
            }
        }
