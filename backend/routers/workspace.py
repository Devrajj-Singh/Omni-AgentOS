"""Workspace file tree and file content endpoints."""
from __future__ import annotations

import os
import codecs
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter()

MAX_TREE_DEPTH = 4
MAX_FILE_SIZE = 500 * 1024
SKIPPED_DIRS = {
    "node_modules",
    ".git",
    "__pycache__",
    ".next",
    ".venv",
    "venv",
    "dist",
    "build",
    ".pytest_cache",
}

LANGUAGE_DETECTION_MAP = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".md": "Markdown",
    ".json": "JSON",
    ".css": "CSS",
    ".html": "HTML",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".cpp": "C/C++",
    ".c": "C/C++",
}

LANGUAGE_MAP = {
    "py": "python",
    "ts": "typescript",
    "tsx": "tsx",
    "js": "javascript",
    "jsx": "jsx",
    "json": "json",
    "md": "markdown",
    "css": "css",
    "html": "html",
    "yaml": "yaml",
    "yml": "yaml",
    "sh": "bash",
    "rs": "rust",
    "go": "go",
    "java": "java",
    "cpp": "cpp",
    "c": "c",
    "env": "bash",
    "toml": "toml",
}


class OpenWorkspaceRequest(BaseModel):
    """Request body for opening a workspace directory."""

    path: str


class FileNode(BaseModel):
    """File tree node returned to the developer workspace."""

    name: str
    path: str
    type: Literal["file", "directory"]
    extension: str = ""
    children: list["FileNode"] = Field(default_factory=list)
    size: int = 0


class OpenWorkspaceResponse(BaseModel):
    """Workspace tree response."""

    path: str
    name: str
    tree: list[FileNode]
    file_count: int
    languages: list[str]


class FileContentResponse(BaseModel):
    """Single file content response."""

    path: str
    name: str
    extension: str
    content: str
    size: int
    lines: int
    language: str


def _is_skipped_file(name: str) -> bool:
    return name.endswith(".pyc")


def _extension_for(path: str) -> str:
    suffix = Path(path).suffix
    return suffix[1:].lower() if suffix else ""


def _depth_for(root_path: str, current_path: str) -> int:
    rel_path = os.path.relpath(current_path, root_path)
    if rel_path == ".":
        return 0
    return len(Path(rel_path).parts)


@router.post("/workspace/open", response_model=OpenWorkspaceResponse)
async def open_workspace(request: OpenWorkspaceRequest) -> OpenWorkspaceResponse:
    """Open a workspace directory and return a shallow, sorted file tree."""
    root_path = os.path.abspath(os.path.expanduser(request.path))

    if not os.path.exists(root_path):
        raise HTTPException(status_code=400, detail=f"Path does not exist: {request.path}")
    if not os.path.isdir(root_path):
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {request.path}")

    root_node = FileNode(
        name=os.path.basename(root_path) or root_path,
        path=root_path,
        type="directory",
    )
    directories_by_path = {root_path: root_node}
    detected_languages: set[str] = set()
    file_count = 0

    for current_path, dirnames, filenames in os.walk(root_path, topdown=True):
        current_depth = _depth_for(root_path, current_path)
        parent_node = directories_by_path.get(current_path)
        if parent_node is None:
            dirnames[:] = []
            continue

        dirnames[:] = sorted(
            dirname for dirname in dirnames if dirname not in SKIPPED_DIRS
        )
        filenames = sorted(filename for filename in filenames if not _is_skipped_file(filename))

        if current_depth >= MAX_TREE_DEPTH:
            dirnames[:] = []
            continue

        for dirname in dirnames:
            directory_path = os.path.join(current_path, dirname)
            node = FileNode(name=dirname, path=directory_path, type="directory")
            parent_node.children.append(node)
            directories_by_path[directory_path] = node

        for filename in filenames:
            file_path = os.path.join(current_path, filename)
            extension = _extension_for(file_path)
            try:
                size = os.path.getsize(file_path)
            except OSError:
                size = 0

            parent_node.children.append(
                FileNode(
                    name=filename,
                    path=file_path,
                    type="file",
                    extension=extension,
                    size=size,
                )
            )
            file_count += 1

            language = LANGUAGE_DETECTION_MAP.get(f".{extension}")
            if language:
                detected_languages.add(language)

    return OpenWorkspaceResponse(
        path=root_path,
        name=os.path.basename(root_path) or root_path,
        tree=root_node.children,
        file_count=file_count,
        languages=sorted(detected_languages),
    )


@router.get("/workspace/file", response_model=FileContentResponse)
async def get_file_content(path: str = Query(...)) -> FileContentResponse:
    """Return UTF-8 text content for a single file."""
    file_path = os.path.abspath(os.path.expanduser(path))

    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail=f"File does not exist: {path}")
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=400, detail=f"Path is not a file: {path}")

    size = os.path.getsize(file_path)
    truncated = size > MAX_FILE_SIZE

    with open(file_path, "rb") as file:
        content_bytes = file.read(MAX_FILE_SIZE if truncated else size)

    try:
        decoder = codecs.getincrementaldecoder("utf-8")()
        content = decoder.decode(content_bytes, final=not truncated)
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Binary file not supported") from exc

    if truncated:
        content = (
            f"[File truncated: showing first {MAX_FILE_SIZE} bytes of {size} bytes]\n\n"
            f"{content}"
        )

    extension = _extension_for(file_path)

    return FileContentResponse(
        path=file_path,
        name=os.path.basename(file_path),
        extension=extension,
        content=content,
        size=size,
        lines=content.count("\n") + (1 if content else 0),
        language=LANGUAGE_MAP.get(extension, "text"),
    )
