"""Health check endpoint."""
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str = Field(..., description="Service status")
    timestamp: datetime = Field(..., description="Current server timestamp")

    class Config:
        json_schema_extra = {
            "example": {"status": "ok", "timestamp": "2024-01-01T12:00:00Z"}
        }


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.

    Returns:
        HealthResponse with status "ok" and current timestamp
    """
    return HealthResponse(status="ok", timestamp=datetime.utcnow())
