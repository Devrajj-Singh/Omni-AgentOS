"""
Filesystem tools for the LangGraph agent.
All tools are sandboxed to the workspace_root path.
"""
import os

SKIPPED_DIRS = {
    "node_modules", ".git", "__pycache__", ".next",
    ".venv", "venv", "dist", "build", ".pytest_cache"
}


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
