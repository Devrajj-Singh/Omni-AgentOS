"""
Global settings store for Omni AgentOS.
In-memory with no persistence - resets on restart.
This is intentional for Phase 7; persistence comes in a future phase.
"""
from __future__ import annotations

from dataclasses import dataclass, field


AVAILABLE_MODELS = [
    {
        "id": "llama-3.3-70b-versatile",
        "name": "Llama 3.3 70B",
        "description": "Best quality, recommended for complex tasks",
        "provider": "Groq",
        "speed": "fast",
    },
    {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B Instant",
        "description": "Fastest responses, good for simple tasks",
        "provider": "Groq",
        "speed": "instant",
    },
    {
        "id": "mixtral-8x7b-32768",
        "name": "Mixtral 8x7B",
        "description": "Strong reasoning, large context window (32K)",
        "provider": "Groq",
        "speed": "fast",
    },
    {
        "id": "gemma2-9b-it",
        "name": "Gemma 2 9B",
        "description": "Google's efficient instruction-tuned model",
        "provider": "Groq",
        "speed": "fast",
    },
]


@dataclass
class AppSettings:
    active_model: str = "llama-3.3-70b-versatile"
    max_file_size_kb: int = 500
    excluded_dirs: list[str] = field(
        default_factory=lambda: [
            "node_modules",
            ".git",
            "__pycache__",
            ".next",
            ".venv",
            "venv",
            "dist",
            "build",
            ".pytest_cache",
        ]
    )


app_settings = AppSettings()
