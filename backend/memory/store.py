"""
ChromaDB-backed memory store for Omni AgentOS.
Persists conversation turns as searchable embeddings.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import chromadb
from chromadb.utils import embedding_functions

CHROMA_PATH = "./data/chroma"
COLLECTION_NAME = "conversation_memory"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
HF_CACHE_MODEL_DIR = Path.home() / ".cache" / "huggingface" / "hub" / "models--sentence-transformers--all-MiniLM-L6-v2"


def _embedding_kwargs() -> dict[str, Any]:
    """Prefer offline cache after the first successful model download."""
    if HF_CACHE_MODEL_DIR.exists():
        return {"local_files_only": True}
    return {}


class MemoryStore:
    """Singleton ChromaDB memory store."""

    def __init__(self) -> None:
        self._client = chromadb.PersistentClient(path=CHROMA_PATH)
        self._ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBEDDING_MODEL,
            **_embedding_kwargs(),
        )
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=self._ef,
            metadata={"hnsw:space": "cosine"},
        )

    def save_turn(
        self,
        session_id: str,
        user_message: str,
        assistant_message: str,
        workspace_path: str | None = None,
    ) -> str:
        """Save a completed conversation turn to memory and return its ID."""
        memory_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        document = f"User: {user_message}\nAssistant: {assistant_message}"

        self._collection.add(
            ids=[memory_id],
            documents=[document],
            metadatas=[
                {
                    "session_id": session_id,
                    "user_message": user_message,
                    "assistant_message": assistant_message[:1000],
                    "timestamp": timestamp,
                    "workspace_path": workspace_path or "",
                }
            ],
        )
        return memory_id

    def search(
        self,
        query: str,
        n_results: int = 5,
        session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Semantic search over memories, optionally filtered by session_id."""
        count = self._collection.count()
        if count == 0:
            return []

        where = {"session_id": session_id} if session_id else None

        try:
            results = self._collection.query(
                query_texts=[query],
                n_results=min(n_results, count),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
        except Exception:
            return []

        if not results["ids"] or not results["ids"][0]:
            return []

        memories = []
        for i, memory_id in enumerate(results["ids"][0]):
            memories.append(
                {
                    "id": memory_id,
                    "document": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "relevance": round(1 - results["distances"][0][i], 3),
                }
            )

        return memories

    def get_all(self, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        """Get all memories ordered by timestamp descending."""
        count = self._collection.count()
        if count == 0:
            return []

        results = self._collection.get(
            limit=limit,
            offset=offset,
            include=["documents", "metadatas"],
        )

        memories = []
        for i, memory_id in enumerate(results["ids"]):
            memories.append(
                {
                    "id": memory_id,
                    "document": results["documents"][i],
                    "metadata": results["metadatas"][i],
                }
            )

        memories.sort(
            key=lambda memory: memory["metadata"].get("timestamp", ""),
            reverse=True,
        )
        return memories

    def delete(self, memory_id: str) -> bool:
        """Delete a memory by ID."""
        try:
            self._collection.delete(ids=[memory_id])
            return True
        except Exception:
            return False

    def count(self) -> int:
        """Return total number of stored memories."""
        return self._collection.count()

    def get_relevant_context(self, query: str, n_results: int = 3) -> str:
        """Format relevant memories for injection into agent context."""
        if self.count() == 0:
            return ""

        memories = self.search(query, n_results=n_results)
        if not memories:
            return ""

        lines = ["Relevant past conversations:"]
        for memory in memories:
            meta = memory["metadata"]
            ts = meta.get("timestamp", "")[:10]
            lines.append(f"[{ts}] User: {meta.get('user_message', '')}")
            lines.append(f"       Assistant: {meta.get('assistant_message', '')[:200]}")
            lines.append("")

        return "\n".join(lines)


memory_store = MemoryStore()
