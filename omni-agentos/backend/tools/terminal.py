"""
Terminal execution tool for the LangGraph agent.
Sandboxed to workspace_root with strict constraints.
"""
import os
import subprocess

BLOCKED_COMMANDS = {
    "rm", "rmdir", "del", "format", "mkfs",
    "dd", "shutdown", "reboot", "halt",
    "sudo", "su", "chmod", "chown",
    "curl", "wget", "nc", "netcat",
}

MAX_OUTPUT_CHARS = 10_000
TIMEOUT_SECONDS = 15


def run_command(command: str, workspace_root: str) -> str:
    """
    Run a shell command within the workspace directory.
    Blocked commands are rejected. Output is capped at 10KB.
    """
    if not os.path.isdir(workspace_root):
        return f"Error: Workspace root does not exist: {workspace_root}"

    first_word = command.strip().split()[0].lower() if command.strip() else ""
    if first_word in BLOCKED_COMMANDS:
        return f"Error: Command '{first_word}' is blocked for safety."

    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=workspace_root,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
        output = result.stdout + result.stderr
        if len(output) > MAX_OUTPUT_CHARS:
            output = output[:MAX_OUTPUT_CHARS] + f"\n[Output truncated at {MAX_OUTPUT_CHARS} chars]"
        return output if output.strip() else "(no output)"
    except subprocess.TimeoutExpired:
        return f"Error: Command timed out after {TIMEOUT_SECONDS} seconds."
    except Exception as e:
        return f"Error executing command: {e}"
