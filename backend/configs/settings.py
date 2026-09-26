"""
Global settings store for Omni AgentOS.
In-memory with no persistence - resets on restart.
This is intentional for Phase 7; persistence comes in a future phase.
"""
from __future__ import annotations

from dataclasses import dataclass, field


AVAILABLE_MODELS = [
    {
        "id": "openai/gpt-oss-120b",
        "name": "GPT-OSS 120B",
        "description": "Best quality, recommended for complex tasks",
        "provider": "OpenAI",
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
        "id": "gemma2-9b-it",
        "name": "Gemma 2 9B",
        "description": "Google's efficient instruction-tuned model",
        "provider": "Groq",
        "speed": "fast",
    },
]


@dataclass
class AppSettings:
    active_model: str = "openai/gpt-oss-120b"
    user_api_key: str | None = None
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
