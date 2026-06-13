"""Session store for managing conversation history."""
from models.message import Message


class SessionStore:
    """In-memory session storage for conversation history."""

    def __init__(self) -> None:
        """Initialize the session store with an empty dictionary."""
        self._sessions: dict[str, list[Message]] = {}

    def get_history(self, session_id: str) -> list[Message]:
        """
        Get conversation history for a session.
        
        Auto-creates an empty list for new sessions.

        Args:
            session_id: The unique session identifier

        Returns:
            List of messages in the conversation history
        """
        return self._sessions.get(session_id, [])

    def append_messages(self, session_id: str, messages: list[Message]) -> None:
        """
        Append messages to session history.

        Args:
            session_id: The unique session identifier
            messages: List of messages to append
        """
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        self._sessions[session_id].extend(messages)


# Module-level singleton instance
session_store = SessionStore()


def get_session_store() -> SessionStore:
    """
    Dependency function to get the session store singleton.
    
    Returns:
        The module-level SessionStore singleton instance
    """
    return session_store
