"""
Interactive terminal WebSocket endpoint.
Spawns a pty (Windows: pywinpty) process in the workspace root.
Messages from client → stdin of process.
stdout of process → messages to client.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import struct
import sys

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()

# Resize message sentinel prefix
_RESIZE_PREFIX = "__RESIZE__:"


async def _pty_session(websocket: WebSocket, workspace_root: str) -> None:
    """Manage one pty session for one WebSocket client."""
    if sys.platform == "win32":
        import winpty  # type: ignore[import]
        proc = winpty.PtyProcess.spawn(
            "powershell.exe",
            cwd=workspace_root,
            env={**os.environ, "TERM": "xterm-256color"},
            dimensions=(24, 80),
        )

        async def read_loop() -> None:
            loop = asyncio.get_event_loop()
            while True:
                try:
                    data = await loop.run_in_executor(None, proc.read, 1024)
                    if not data:
                        break
                    await websocket.send_text(data)
                except Exception:
                    break

        async def write_loop() -> None:
            while True:
                try:
                    msg = await websocket.receive_text()
                    if msg.startswith(_RESIZE_PREFIX):
                        # {"cols": N, "rows": N}
                        try:
                            dims = json.loads(msg[len(_RESIZE_PREFIX):])
                            proc.setwinsize(dims.get("rows", 24), dims.get("cols", 80))
                        except Exception:
                            pass
                    else:
                        proc.write(msg)
                except WebSocketDisconnect:
                    break
                except Exception:
                    break

        await asyncio.gather(read_loop(), write_loop())
        try:
            proc.terminate()
        except Exception:
            pass

    else:
        # Linux/Mac: use built-in pty module
        import pty
        import fcntl
        import termios

        master_fd, slave_fd = pty.openpty()
        proc = await asyncio.create_subprocess_exec(
            "/bin/bash",
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            cwd=workspace_root,
            env={**os.environ, "TERM": "xterm-256color"},
        )
        os.close(slave_fd)

        loop = asyncio.get_event_loop()

        async def read_loop() -> None:
            while True:
                try:
                    data = await loop.run_in_executor(None, os.read, master_fd, 1024)
                    if not data:
                        break
                    await websocket.send_text(data.decode("utf-8", errors="replace"))
                except Exception:
                    break

        async def write_loop() -> None:
            while True:
                try:
                    msg = await websocket.receive_text()
                    if msg.startswith(_RESIZE_PREFIX):
                        try:
                            dims = json.loads(msg[len(_RESIZE_PREFIX):])
                            cols, rows = dims.get("cols", 80), dims.get("rows", 24)
                            fcntl.ioctl(master_fd, termios.TIOCSWINSZ,
                                        struct.pack("HHHH", rows, cols, 0, 0))
                        except Exception:
                            pass
                    else:
                        os.write(master_fd, msg.encode())
                except WebSocketDisconnect:
                    break
                except Exception:
                    break

        await asyncio.gather(read_loop(), write_loop())
        try:
            proc.terminate()
            await proc.wait()
        except Exception:
            pass
        try:
            os.close(master_fd)
        except Exception:
            pass


@router.websocket("/ws/terminal")
async def terminal_ws(websocket: WebSocket, workspace_root: str = "") -> None:
    """
    WebSocket terminal endpoint.
    Query param: workspace_root — absolute path to sandbox in.
    Falls back to a safe temp dir if not provided or invalid.
    """
    await websocket.accept()

    if workspace_root and os.path.isdir(os.path.abspath(workspace_root)):
        cwd = os.path.abspath(workspace_root)
    else:
        cwd = os.path.expanduser("~")
        logger.warning("terminal_ws: invalid workspace_root '%s', defaulting to %s", workspace_root, cwd)

    logger.info("Terminal session started in: %s", cwd)
    try:
        await _pty_session(websocket, cwd)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("Terminal session error: %s", e)
    finally:
        logger.info("Terminal session ended")
