"""Structured logging for agent orchestration - foundation for Phase 9.5."""
from __future__ import annotations

import json
import logging
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Any

logger = logging.getLogger("omni.agents")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)


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
