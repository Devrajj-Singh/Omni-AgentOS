"""Structured logging for agent orchestration - foundation for Phase 9.5."""
from __future__ import annotations

import json
import logging
import time
from collections import deque
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger("omni.agents")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)

MAX_EVENTS = 500
_event_buffer: deque[dict[str, Any]] = deque(maxlen=MAX_EVENTS)
_LOG_FILE = Path(__file__).resolve().parent.parent / "data" / "observability.jsonl"


def _load_existing_events() -> None:
    """Load persisted events from disk into the in-memory buffer at startup."""
    if not _LOG_FILE.exists():
        return
    try:
        lines = _LOG_FILE.read_text(encoding="utf-8").splitlines()
        for line in lines[-MAX_EVENTS:]:
            if not line.strip():
                continue
            try:
                _event_buffer.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    except OSError:
        pass


def _persist_event(record: dict[str, Any]) -> None:
    """Append one event to the .jsonl file. Best-effort; never raises."""
    try:
        _LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_LOG_FILE, "a", encoding="utf-8") as file:
            file.write(json.dumps(record) + "\n")
    except OSError:
        pass


def log_event(
    event_type: str,
    task_id: str,
    agent: str | None = None,
    **fields: Any,
) -> None:
    """Emit one structured JSON log line."""
    record = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "task_id": task_id,
        "agent": agent,
        **fields,
    }
    logger.info(json.dumps(record))
    _event_buffer.append(record)
    _persist_event(record)


@contextmanager
def timed_span(event_type: str, task_id: str, agent: str, **fields: Any):
    """Context manager that logs start and end with duration_ms."""
    start = time.perf_counter()
    log_event(f"{event_type}_start", task_id, agent, **fields)
    try:
        yield
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log_event(
            f"{event_type}_end",
            task_id,
            agent,
            duration_ms=duration_ms,
            **fields,
        )


def get_recent_events(limit: int = 200) -> list[dict[str, Any]]:
    """Return the most recent events, newest last."""
    events = list(_event_buffer)
    return events[-limit:]


def get_events_for_task(task_id: str) -> list[dict[str, Any]]:
    """Return all buffered events for a specific task_id, in order."""
    return [event for event in _event_buffer if event.get("task_id") == task_id]


def get_task_ids(limit: int = 50) -> list[str]:
    """Return distinct task_ids from the buffer, most recently seen first."""
    seen: list[str] = []
    for event in reversed(_event_buffer):
        task_id = event.get("task_id")
        if task_id and task_id not in seen:
            seen.append(task_id)
        if len(seen) >= limit:
            break
    return seen


_load_existing_events()
