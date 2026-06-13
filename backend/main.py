"""
Omni AgentOS Backend - FastAPI Application Entry Point
Phase 0: Application shell with session management and WebSocket echo server
"""
from contextlib import asynccontextmanager
from datetime import datetime
import logging
import os

from dotenv import load_dotenv

# Load environment variables BEFORE importing routers
# (routers import llm.py which reads GEMINI_API_KEY at module level)
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from tools.websearch import TAVILY_AVAILABLE

from routers import approval, chat, health, memory, research, session, settings_router, websocket, workspace

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown events."""
    logger.info("🚀 Omni AgentOS Backend starting up at %s", datetime.utcnow().isoformat())
    
    # Validate required environment variables
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        error_msg = "GROQ_API_KEY is not set. Add it to your .env file."
        logger.error(error_msg)
        raise EnvironmentError(error_msg)
    
    tavily_key = os.getenv("TAVILY_API_KEY")
    if tavily_key == "your_tavily_key_here":
        tavily_key = ""
    if not tavily_key:
        logger.warning("TAVILY_API_KEY not set - web search will be unavailable")
    elif not TAVILY_AVAILABLE:
        logger.warning("tavily-python is not installed - web search will be unavailable")
    else:
        logger.info("Tavily web search enabled")

    logger.info("✅ Environment configuration validated")
    yield
    logger.info("🛑 Omni AgentOS Backend shutting down at %s", datetime.utcnow().isoformat())


def create_app() -> FastAPI:
    """Factory function to create and configure the FastAPI application."""
    app = FastAPI(
        title="Omni AgentOS API",
        description="Backend API for Omni AgentOS - Modular AI Workspace Platform",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Configure CORS with environment-based origins
    allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount routers
    app.include_router(health.router, tags=["health"])
    app.include_router(session.router, prefix="/api/v1", tags=["session"])
    app.include_router(approval.router, prefix="/api/v1", tags=["approval"])
    app.include_router(chat.router, tags=["chat"])
    app.include_router(memory.router, prefix="/api/v1", tags=["memory"])
    app.include_router(research.router, prefix="/api/v1", tags=["research"])
    app.include_router(settings_router.router, prefix="/api/v1", tags=["settings"])
    app.include_router(websocket.router, tags=["websocket"])
    app.include_router(workspace.router, prefix="/api/v1", tags=["workspace"])

    return app


app = create_app()
