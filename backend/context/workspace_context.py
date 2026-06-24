"""
Workspace Context Engine - Phase 11.
Parses dependency files and assembles a rich project context string
that gets injected into every agent turn automatically.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DEPENDENCY_FILES = [
    "pyproject.toml",
    "requirements.txt",
    "setup.py",
    "Pipfile",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "Gemfile",
    "pom.xml",
    "build.gradle",
]

MAX_DEPS_SHOWN = 12


def _read_file_safe(path: Path) -> str | None:
    """Read a file, returning None if it is unavailable."""
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def _parse_package_json(content: str) -> dict[str, Any]:
    """Extract name, version, and key deps from package.json."""
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return {}

    result: dict[str, Any] = {}
    if name := data.get("name"):
        result["name"] = name
    if version := data.get("version"):
        result["version"] = version

    deps: dict[str, str] = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))

    if deps:
        key_deps = {key: value for key, value in deps.items() if not key.startswith("@types/")}
        result["deps"] = dict(list(key_deps.items())[:MAX_DEPS_SHOWN])
        result["ecosystem"] = "Node.js"

    return result


def _parse_requirements_txt(content: str) -> dict[str, Any]:
    """Extract packages from requirements.txt."""
    packages = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue

        package = (
            line.split("==")[0]
            .split(">=")[0]
            .split("<=")[0]
            .split("~=")[0]
            .split("[")[0]
            .strip()
        )
        if package:
            packages.append(package)

    return {
        "ecosystem": "Python",
        "deps": {package: "" for package in packages[:MAX_DEPS_SHOWN]},
    }


def _parse_pyproject_toml(content: str) -> dict[str, Any]:
    """Extract name, version, and deps from pyproject.toml with a small parser."""
    result: dict[str, Any] = {"ecosystem": "Python"}
    packages = []

    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("name =") or stripped.startswith("name="):
            result["name"] = stripped.split("=", 1)[1].strip().strip('"').strip("'")
        elif stripped.startswith("version =") or stripped.startswith("version="):
            result["version"] = stripped.split("=", 1)[1].strip().strip('"').strip("'")
        elif stripped.startswith('"') or stripped.startswith("'"):
            package = stripped.strip('"').strip("'").split('"')[0].split("'")[0]
            package = package.split(">=")[0].split("==")[0].split("^")[0].strip()
            if package and package != "python":
                packages.append(package)

    if packages:
        result["deps"] = {package: "" for package in packages[:MAX_DEPS_SHOWN]}

    return result


def _parse_cargo_toml(content: str) -> dict[str, Any]:
    """Extract name and deps from Cargo.toml with a basic line parser."""
    result: dict[str, Any] = {"ecosystem": "Rust"}
    packages = []
    in_deps = False

    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("name =") and "name" not in result:
            result["name"] = stripped.split("=", 1)[1].strip().strip('"')
        elif stripped.startswith("version =") and "version" not in result:
            result["version"] = stripped.split("=", 1)[1].strip().strip('"')
        elif stripped in ("[dependencies]", "[dev-dependencies]"):
            in_deps = True
        elif stripped.startswith("[") and stripped != "[dependencies]":
            in_deps = False
        elif in_deps and "=" in stripped and not stripped.startswith("#"):
            package = stripped.split("=")[0].strip()
            if package:
                packages.append(package)

    if packages:
        result["deps"] = {package: "" for package in packages[:MAX_DEPS_SHOWN]}

    return result


def _parse_go_mod(content: str) -> dict[str, Any]:
    """Extract module name and deps from go.mod."""
    result: dict[str, Any] = {"ecosystem": "Go"}
    packages = []
    in_require = False

    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("module "):
            result["name"] = stripped.removeprefix("module ").strip()
        elif stripped == "require (":
            in_require = True
        elif stripped == ")" and in_require:
            in_require = False
        elif in_require and stripped and not stripped.startswith("//"):
            package = stripped.split()[0]
            parts = package.split("/")
            packages.append("/".join(parts[-2:]) if len(parts) > 2 else package)
        elif stripped.startswith("require ") and not in_require:
            package = stripped.removeprefix("require ").split()[0]
            packages.append(package)

    if packages:
        result["deps"] = {package: "" for package in packages[:MAX_DEPS_SHOWN]}

    return result


def _detect_project_type(workspace_root: str) -> dict[str, Any]:
    """
    Walk through dependency files in priority order and parse the first match.
    """
    root = Path(workspace_root)
    for filename in DEPENDENCY_FILES:
        filepath = root / filename
        content = _read_file_safe(filepath)
        if content is None:
            continue

        if filename == "package.json":
            return _parse_package_json(content)
        if filename == "requirements.txt":
            return _parse_requirements_txt(content)
        if filename == "pyproject.toml":
            return _parse_pyproject_toml(content)
        if filename == "Cargo.toml":
            return _parse_cargo_toml(content)
        if filename == "go.mod":
            return _parse_go_mod(content)
        return {"ecosystem": filename, "deps": {}}

    return {}


def _detect_stack_hints(workspace_root: str) -> list[str]:
    """Look for well-known config and marker files."""
    root = Path(workspace_root)
    hints = []

    markers = {
        "Dockerfile": "Docker",
        "docker-compose.yml": "Docker Compose",
        "docker-compose.yaml": "Docker Compose",
        ".github/workflows": "GitHub Actions",
        "next.config.js": "Next.js",
        "next.config.ts": "Next.js",
        "vite.config.ts": "Vite",
        "vite.config.js": "Vite",
        "tailwind.config.ts": "Tailwind CSS",
        "tailwind.config.js": "Tailwind CSS",
        ".eslintrc.json": "ESLint",
        "jest.config.ts": "Jest",
        "pytest.ini": "pytest",
        "pyproject.toml": "pyproject",
        "alembic.ini": "Alembic (DB migrations)",
        "Makefile": "Makefile",
    }

    for marker, label in markers.items():
        if (root / marker).exists():
            hints.append(label)

    return hints[:8]


def build_project_context(
    workspace_root: str | None,
    active_file_path: str | None,
    recently_opened_files: list[str] | None = None,
) -> str:
    """
    Assemble a rich project context string for injection into every agent turn.
    """
    if not workspace_root:
        return ""

    lines: list[str] = ["## Project Context (auto-detected)"]

    project_info = _detect_project_type(workspace_root)
    ecosystem = project_info.get("ecosystem", "")
    project_name = project_info.get("name") or Path(workspace_root).name
    version = project_info.get("version", "")
    deps = project_info.get("deps", {})

    identity = f"Project: {project_name}"
    if version:
        identity += f" v{version}"
    if ecosystem:
        identity += f" ({ecosystem})"
    lines.append(identity)

    hints = _detect_stack_hints(workspace_root)
    if hints:
        lines.append(f"Stack: {', '.join(hints)}")

    if deps:
        dep_list = list(deps.keys())
        lines.append(f"Key dependencies: {', '.join(dep_list)}")

    if active_file_path:
        lines.append(f"Currently open: {active_file_path}")

    if recently_opened_files:
        recent = [path for path in recently_opened_files if path != active_file_path][:5]
        if recent:
            lines.append(f"Recently active: {', '.join(recent)}")

    return "\n".join(lines)
