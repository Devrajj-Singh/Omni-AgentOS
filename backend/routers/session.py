"""Session management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.session_store import SessionStore, get_session_store
from models.session import Session

router = APIRouter()


@router.post("/session", response_model=Session, status_code=status.HTTP_201_CREATED)
async def create_session(store: SessionStore = Depends(get_session_store)) -> Session:
    """
    Create a new session.

    Args:
        store: SessionStore dependency

    Returns:
        The newly created session with a unique session_id
    """
    session = Session()
    store.save(session)
    return session


@router.get("/session/{session_id}", response_model=Session)
async def get_session(
    session_id: str, store: SessionStore = Depends(get_session_store)
) -> Session:
    """
    Retrieve a session by ID.

    Args:
        session_id: The unique session identifier
        store: SessionStore dependency

    Returns:
        The session if found

    Raises:
        HTTPException: 404 if session not found
    """
    session = store.get(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found",
        )
    return session
