"""
Filesystem tools for the LangGraph agent.
All tools are sandboxed to the workspace_root path.
"""
import os
from pathlib import Path

SKIPPED_DIRS = {
    "node_modules", ".git", "__pycache__", ".next",
    ".venv", "venv", "dist", "build", ".pytest_cache"
}

COMMON_IGNORE_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "build",
    ".next", ".pytest_cache", "chroma", ".mypy_cache", "coverage",
}
COMMON_IGNORE_FILES_SUFFIXES = {".pyc", ".pyo", ".lock"}
MAX_SCAN_FILES = 500
MAX_SCAN_DEPTH = 6
MAX_SCAN_OUTPUT_CHARS = 6000


def _validate_path(path: str, workspace_root: str) -> str:
    """
    Ensure path is within workspace_root. Raises ValueError if not.
    Returns absolute path.
    """
    abs_path = os.path.abspath(os.path.join(workspace_root, path))
    abs_root = os.path.abspath(workspace_root)
    if os.path.commonpath([abs_path, abs_root]) != abs_root:
        raise ValueError(f"Path '{path}' is outside the workspace root.")
    return abs_path


def read_file(path: str, workspace_root: str) -> str:
    """Read a file within the workspace. Returns its content as a string."""
    abs_path = _validate_path(path, workspace_root)
    if not os.path.exists(abs_path):
        return f"Error: File not found: {path}"
    if not os.path.isfile(abs_path):
        return f"Error: Path is not a file: {path}"
    try:
        with open(abs_path, encoding="utf-8") as f:
            content = f.read(50_000)
        return content
    except UnicodeDecodeError:
        return f"Error: Binary file cannot be read: {path}"
    except OSError as e:
        return f"Error reading file: {e}"


def write_file(path: str, content: str, workspace_root: str) -> str:
    """Write content to a file within the workspace. Creates parent dirs if needed."""
    abs_path = _validate_path(path, workspace_root)
    try:
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote {len(content)} characters to {path}"
    except OSError as e:
        return f"Error writing file: {e}"


def list_directory(path: str, workspace_root: str) -> str:
    """List files and directories at path within the workspace."""
    abs_path = _validate_path(path, workspace_root)
    if not os.path.exists(abs_path):
        return f"Error: Directory not found: {path}"
    if not os.path.isdir(abs_path):
        return f"Error: Path is not a directory: {path}"
    try:
        entries = os.listdir(abs_path)
        dirs = sorted(
            e for e in entries
            if os.path.isdir(os.path.join(abs_path, e)) and e not in SKIPPED_DIRS
        )
        files = sorted(
            e for e in entries
            if os.path.isfile(os.path.join(abs_path, e))
        )
        result = []
        for directory in dirs:
            result.append(f"[DIR]  {directory}/")
        for file_name in files:
            size = os.path.getsize(os.path.join(abs_path, file_name))
            result.append(f"[FILE] {file_name} ({size} bytes)")
        return "\n".join(result) if result else "(empty directory)"
    except OSError as e:
        return f"Error listing directory: {e}"


def scan_repository(workspace_root: str | None) -> str:
    """
    Walk the workspace tree (respecting common ignore patterns) and return a
    compact structural summary: relative path, file size, and file count per
    directory. Does NOT read file contents. Caps at MAX_SCAN_FILES to avoid
    runaway output on very large repos.
    """
    if not workspace_root:
        return "No workspace is open. Cannot scan a repository."

    root = Path(workspace_root)
    if not root.exists() or not root.is_dir():
        return f"Workspace root does not exist: {workspace_root}"

    lines: list[str] = []
    file_count = 0
    truncated = False

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d for d in dirnames
            if d not in COMMON_IGNORE_DIRS and not d.startswith(".")
        ]

        rel_dir = os.path.relpath(dirpath, root)
        depth = 0 if rel_dir == "." else rel_dir.count(os.sep) + 1
        if depth > MAX_SCAN_DEPTH:
            dirnames[:] = []
            continue

        for filename in sorted(filenames):
            if any(filename.endswith(suffix) for suffix in COMMON_IGNORE_FILES_SUFFIXES):
                continue
            if file_count >= MAX_SCAN_FILES:
                truncated = True
                break
            file_path = Path(dirpath) / filename
            try:
                size = file_path.stat().st_size
            except OSError:
                size = 0
            rel_path = os.path.relpath(file_path, root)
            lines.append(f"{rel_path} ({size} bytes)")
            file_count += 1

        if truncated:
            break

    summary = "\n".join(lines)
    if len(summary) > MAX_SCAN_OUTPUT_CHARS:
        summary = summary[:MAX_SCAN_OUTPUT_CHARS]
        truncated = True

    if truncated:
        summary += (
            "\n\n[Scan truncated. Repository has more files/content than shown. "
            "Use list_directory_tool on specific subdirectories for more detail if needed.]"
        )

    return f"Repository structure ({file_count} files shown):\n{summary}"
