"""
Coder Agent - LangGraph ReAct agent with filesystem and terminal tools.
Streams tokens and tool events over WebSocket.
"""
from __future__ import annotations

import os
import asyncio
import concurrent.futures
from collections.abc import Awaitable, Callable
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent

from configs.settings import app_settings
from execution.approval_store import ApprovalDecision, approval_store
from memory.store import memory_store
from tools.filesystem import list_directory, read_file, write_file
from tools.terminal import run_command
from tools.websearch import TAVILY_API_KEY, TAVILY_AVAILABLE, web_search

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
AGENT_TIMEOUT_SECONDS = 90
DOCUMENT_QUERY_TERMS = {
    "upload", "uploaded", "file", "files", "document", "documents", "doc", "docs",
    "pdf", "word", "powerpoint", "excel", "spreadsheet", "summarize", "summarise",
    "summary", "analyze", "analyse",
}
WORKSPACE_ACTION_TERMS = {
    "add", "append", "build", "change", "command", "create", "delete", "edit",
    "execute", "fix", "generate", "install", "make", "modify", "move", "npm",
    "patch", "pip", "read", "rename", "replace", "run", "save", "terminal",
    "update", "write",
}
EXPLICIT_DOCUMENT_TERMS = {
    "upload", "uploaded", "document", "documents", "doc", "docs", "pdf",
    "word", "powerpoint", "excel", "spreadsheet", "summarize", "summarise",
    "summary", "analyze", "analyse",
}
GENERIC_DOCUMENT_TERMS = DOCUMENT_QUERY_TERMS | {"this", "that", "the", "what", "does", "say", "content"}

SYSTEM_PROMPT = """You are Omni AgentOS - an intelligent AI coding and research assistant.

## Available Tools
- search_documents: Search uploaded research documents. Use this ONLY for uploaded documents, PDFs, summaries, or analysis requests. Do not use it for creating, reading, editing, or writing workspace files.
- web_search_tool: Search the web for current information. Use ONLY when the user explicitly asks to search online or find recent information.

## Strict Rules - Follow These Exactly
1. NEVER call the same tool more than 2 times per conversation turn.
2. If search_documents returns content, use it to answer - do NOT also call web_search_tool.
3. If search_documents returns no results, tell the user "No content found in uploaded documents" - do NOT fall back to web_search_tool automatically.
4. If web_search_tool returns results, summarize them and STOP - do not call it again.
5. Once you have enough information to answer, stop using tools and respond.
6. If asked to summarize an uploaded file, use search_documents with the filename or topic as the query.

## Response Style
- Be concise and direct
- Cite source URLs when using web search results
- For code, always use proper markdown code blocks
- Think step by step but keep responses focused"""

WORKSPACE_TOOLS_PROMPT = """

## Workspace Tools (available - a workspace folder is open)
- read_file_tool: Read a file from the workspace filesystem.
- write_file_tool: Write or create a file in the workspace.
- list_directory_tool: List files in a workspace directory.
- run_command_tool: Run a terminal command in the workspace.

## Additional Rule
7. If asked to create, write, edit, read, or inspect a workspace file, use the filesystem tools, not search_documents."""


def _query_terms(query: str) -> set[str]:
    normalized = (
        query.lower()
        .replace(".", " ")
        .replace("_", " ")
        .replace("-", " ")
        .replace("/", " ")
        .replace("\\", " ")
    )
    return {term for term in normalized.split() if len(term) > 2}


def _is_document_query(message: str) -> bool:
    terms = _query_terms(message)
    if terms & WORKSPACE_ACTION_TERMS and not terms & EXPLICIT_DOCUMENT_TERMS:
        return False
    return bool(terms & DOCUMENT_QUERY_TERMS)


def _search_uploaded_documents(query: str, limit: int = 8) -> str:
    """Search uploaded document chunks and return formatted excerpts."""
    try:
        doc_parts = []
        query_terms = _query_terms(query)

        results = memory_store.search(query=query, n_results=limit)
        for result in results:
            meta = result.get("metadata", {})
            session_id = meta.get("session_id", "")
            if not session_id.startswith("doc:"):
                continue

            filename = meta.get("workspace_path", "Unknown file")
            content = meta.get("assistant_message", "")
            if content:
                doc_parts.append(f"[Source: {filename}]\n{content}")

        if not doc_parts:
            specific_terms = query_terms - GENERIC_DOCUMENT_TERMS
            should_return_recent = not specific_terms

            for mem in memory_store.get_all(limit=1000):
                meta = mem.get("metadata", {})
                session_id = meta.get("session_id", "")
                if not session_id.startswith("doc:"):
                    continue

                filename = meta.get("workspace_path", "Unknown file")
                content = meta.get("assistant_message", "")
                haystack = f"{filename}\n{content}".lower()
                has_term_match = any(term in haystack for term in specific_terms)

                if content and (should_return_recent or has_term_match):
                    doc_parts.append(f"[Source: {filename}]\n{content}")
                if len(doc_parts) >= limit:
                    break

        if not doc_parts:
            return "No uploaded document content found. The user may not have uploaded any documents yet."

        return "\n\n---\n\n".join(doc_parts)

    except Exception as e:
        return f"Document search error: {str(e)}"


def _preview_text(text: str, max_length: int = 200) -> str:
    """Return a compact preview for approval payloads."""
    return f"{text[:max_length]}..." if len(text) > max_length else text


def _await_approval(
    request_id: str,
    tool_name: str,
    args: dict[str, Any],
    description: str,
    risk_level: str,
    approval_loop: asyncio.AbstractEventLoop,
    on_approval_required: Callable[[str, str, dict[str, Any], str, str], Awaitable[None]],
) -> ApprovalDecision:
    """Notify the UI and wait for a decision from a synchronous tool."""
    notify_future = asyncio.run_coroutine_threadsafe(
        on_approval_required(request_id, tool_name, args, description, risk_level),
        approval_loop,
    )
    notify_future.result(timeout=5)

    request = approval_store.get(request_id)
    if request is None:
        return ApprovalDecision.TIMEOUT

    decision_future = asyncio.run_coroutine_threadsafe(
        asyncio.wait_for(request.future, timeout=30.0),
        approval_loop,
    )
    try:
        return decision_future.result(timeout=35)
    except (TimeoutError, concurrent.futures.TimeoutError):
        approval_store.resolve(request_id, ApprovalDecision.TIMEOUT)
        return ApprovalDecision.TIMEOUT


def _build_tools(
    workspace_root: str | None,
    autonomous_mode: bool,
    on_approval_required: Callable[[str, str, dict[str, Any], str, str], Awaitable[None]],
    approval_loop: asyncio.AbstractEventLoop,
    allow_document_search: bool,
) -> list:
    """Build LangChain tools bound to the workspace root."""
    tool_call_counts: dict[str, int] = {}

    def _can_call(tool_name: str) -> bool:
        tool_call_counts[tool_name] = tool_call_counts.get(tool_name, 0) + 1
        return tool_call_counts[tool_name] <= 2

    @tool
    def search_documents(query: str) -> str:
        """
        Search content from uploaded research documents.
        Use this when asked about uploaded files, to summarize documents,
        or to find information from documents the user has uploaded.
        The query can be a topic, filename, or any relevant search term.
        """
        if not _can_call("search_documents"):
            return "Tool call limit reached for search_documents. Use the available document results to answer."

        return _search_uploaded_documents(query=query, limit=8)

    @tool
    def read_file_tool(path: str) -> str:
        """Read the content of a file. Path is relative to workspace root."""
        if not _can_call("read_file_tool"):
            return "Tool call limit reached for read_file_tool. Use the available file results to answer."
        return read_file(path, workspace_root)

    @tool
    def write_file_tool(path: str, content: str) -> str:
        """Write content to a file. Path is relative to workspace root. Creates file if not exists."""
        if not _can_call("write_file_tool"):
            return "Tool call limit reached for write_file_tool. Stop and summarize what is already done."
        if not autonomous_mode:
            normalized_path = path.lower()
            risk = "high" if any(term in normalized_path for term in [".env", "config", "secret"]) else "medium"
            description = f"Write {len(content)} characters to `{path}`"
            request = approval_store.create(
                tool="write_file_tool",
                args={"path": path, "content": _preview_text(content)},
                description=description,
                risk_level=risk,
                loop=approval_loop,
            )
            decision = _await_approval(
                request.approval_id,
                "write_file_tool",
                {"path": path, "content": _preview_text(content, 120)},
                description,
                risk,
                approval_loop,
                on_approval_required,
            )
            if decision == ApprovalDecision.TIMEOUT:
                return "Action timed out waiting for approval. Please try again."
            if decision != ApprovalDecision.APPROVED:
                return f"Action rejected by user: write to `{path}` was not approved."
        return write_file(path, content, workspace_root)

    @tool
    def list_directory_tool(path: str = ".") -> str:
        """List files and directories at path. Defaults to workspace root."""
        if not _can_call("list_directory_tool"):
            return "Tool call limit reached for list_directory_tool. Use the available directory results to answer."
        return list_directory(path, workspace_root)

    @tool
    def run_command_tool(command: str) -> str:
        """Run a terminal command in the workspace directory. Use for git, npm, pip, etc."""
        if not _can_call("run_command_tool"):
            return "Tool call limit reached for run_command_tool. Use the available command results to answer."
        if not autonomous_mode:
            lowered_command = command.lower()
            high_risk_keywords = ["rm ", "del ", "format", "drop ", "delete", "truncate"]
            risk = "high" if any(keyword in lowered_command for keyword in high_risk_keywords) else "medium"
            description = f"Run command: `{command}`"
            request = approval_store.create(
                tool="run_command_tool",
                args={"command": command},
                description=description,
                risk_level=risk,
                loop=approval_loop,
            )
            decision = _await_approval(
                request.approval_id,
                "run_command_tool",
                {"command": command},
                description,
                risk,
                approval_loop,
                on_approval_required,
            )
            if decision == ApprovalDecision.TIMEOUT:
                return "Action timed out waiting for approval. Please try again."
            if decision != ApprovalDecision.APPROVED:
                return f"Action rejected by user: command `{command}` was not approved."
        return run_command(command, workspace_root)

    @tool
    def web_search_tool(query: str) -> str:
        """Search the web for current information. Use for facts, news, documentation, or anything requiring up-to-date information."""
        if not _can_call("web_search_tool"):
            return "Tool call limit reached for web_search_tool. Use the available web results to answer."
        return web_search(query)

    tools = [search_documents] if allow_document_search else []
    if workspace_root:
        tools.extend([read_file_tool, write_file_tool, list_directory_tool, run_command_tool])
    if TAVILY_API_KEY and TAVILY_AVAILABLE:
        tools.append(web_search_tool)

    return tools


def _convert_history(conversation_history: list[dict[str, Any]]) -> list:
    """Convert Message dicts to LangChain message objects."""
    lc_messages = []
    for msg in conversation_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))
        elif role == "system":
            lc_messages.append(SystemMessage(content=content))
    return lc_messages


def _tool_output_text(output: Any) -> str:
    """Extract readable text from LangChain tool event output."""
    content = getattr(output, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return _content_blocks_text(content)
    return output if isinstance(output, str) else str(output)


def _content_blocks_text(blocks: list[Any]) -> str:
    """Extract text from provider-specific content block lists."""
    text_parts = []
    for block in blocks:
        if isinstance(block, dict):
            text = block.get("text", "")
            if isinstance(text, str):
                text_parts.append(text)
        else:
            text = getattr(block, "text", "")
            if isinstance(text, str):
                text_parts.append(text)
    return "".join(text_parts)


def _message_text(message: Any) -> str:
    """Extract text from a LangChain message or message chunk."""
    content = getattr(message, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return _content_blocks_text(content)
    return ""


def _fallback_document_summary(document_context: str) -> str:
    """Return a short extractive summary when the LLM cannot summarize."""
    excerpts = []
    current_source = "uploaded document"
    for line in document_context.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped == "---":
            continue
        if stripped.startswith("[Source:") and stripped.endswith("]"):
            current_source = stripped.removeprefix("[Source:").removesuffix("]").strip()
            continue
        excerpts.append((current_source, stripped))
        if len(excerpts) >= 5:
            break

    if not excerpts:
        return "I found the uploaded document, but it did not contain enough readable text to summarize."

    source = excerpts[0][0]
    bullets = "\n".join(f"- {text}" for _, text in excerpts[:5])
    return f"Summary of {source}:\n{bullets}"


async def run_agent(
    message: str,
    conversation_history: list[dict[str, Any]],
    workspace_root: str | None,
    active_file_path: str | None,
    memory_context: str,
    autonomous_mode: bool,
    on_token: Callable[[str], Awaitable[None]],
    on_tool_call: Callable[[str, dict[str, Any]], Awaitable[None]],
    on_tool_result: Callable[[str, str], Awaitable[None]],
    on_thinking: Callable[[str], Awaitable[None]],
    on_approval_required: Callable[[str, str, dict[str, Any], str, str], Awaitable[None]],
) -> str:
    """
    Run the ReAct agent and stream events via callbacks.

    Returns:
        Complete assembled response string.
    """
    llm = ChatGroq(
        api_key=GROQ_API_KEY,
        model=app_settings.active_model,
        temperature=0,
        streaming=True,
    )

    approval_loop = asyncio.get_running_loop()
    tools = _build_tools(
        workspace_root,
        autonomous_mode,
        on_approval_required,
        approval_loop,
        allow_document_search=_is_document_query(message),
    )
    agent = create_react_agent(llm, tools)

    context_parts = []
    if workspace_root:
        context_parts.append(f"Workspace root: {workspace_root}")
    if active_file_path:
        context_parts.append(f"Currently open file: {active_file_path}")
    context_str = "\n".join(context_parts)

    effective_system_prompt = SYSTEM_PROMPT
    if workspace_root:
        effective_system_prompt += WORKSPACE_TOOLS_PROMPT

    lc_messages = [SystemMessage(content=effective_system_prompt)]
    if context_str:
        lc_messages.append(SystemMessage(content=f"Context:\n{context_str}"))
    if memory_context:
        lc_messages.append(SystemMessage(content=memory_context))
    lc_messages.extend(_convert_history(conversation_history))
    lc_messages.append(HumanMessage(content=message))

    full_response = ""
    last_tool_name = ""
    last_tool_result = ""
    await on_thinking("Preparing response with workspace context." if workspace_root else "Preparing response.")

    if _is_document_query(message):
        await on_tool_call("search_documents", {"query": message})
        document_context = _search_uploaded_documents(message, limit=8)
        await on_tool_result("search_documents", document_context[:500])

        if (
            document_context.startswith("No uploaded document content found")
            or document_context.startswith("Document search error:")
        ):
            full_response = "No content found in uploaded documents."
            await on_token(full_response)
            return full_response

        summarize_messages = [
            SystemMessage(
                content=(
                    "You are Omni AgentOS. Answer using only the uploaded document excerpts "
                    "provided by search_documents. Do not call tools. Be concise and direct. "
                    "If the user asks for a summary, summarize the document in clear bullets."
                )
            ),
            HumanMessage(
                content=(
                    f"User request: {message}\n\n"
                    f"Uploaded document excerpts:\n{document_context}"
                )
            ),
        ]

        try:
            async with asyncio.timeout(AGENT_TIMEOUT_SECONDS):
                async for chunk in llm.astream(summarize_messages):
                    text = _message_text(chunk)
                    if text:
                        full_response += text
                        await on_token(text)
        except Exception:
            full_response = _fallback_document_summary(document_context)
            await on_token(full_response)

        if not full_response:
            full_response = "I found the uploaded document content, but could not generate a summary."
            await on_token(full_response)

        return full_response

    try:
        async with asyncio.timeout(AGENT_TIMEOUT_SECONDS):
            async for event in agent.astream_events(
                {"messages": lc_messages},
                config={"recursion_limit": 8},
                version="v2",
            ):
                kind = event.get("event", "")
                data = event.get("data", {})
                name = event.get("name", "")

                if kind == "on_tool_start":
                    tool_input = data.get("input", {})
                    await on_tool_call(name, tool_input)

                elif kind == "on_tool_end":
                    output = data.get("output", "")
                    last_tool_name = name
                    last_tool_result = _tool_output_text(output)
                    await on_tool_result(name, last_tool_result[:500])
                    if name == "write_file_tool" and last_tool_result.startswith("Successfully wrote"):
                        full_response = f"Done. {last_tool_result}"
                        await on_token(full_response)
                        break

                elif kind == "on_chat_model_stream":
                    text = _message_text(data.get("chunk"))
                    if text:
                        full_response += text
                        await on_token(text)

                elif kind == "on_chat_model_end" and not full_response:
                    output = data.get("output")
                    generations = getattr(output, "generations", None)
                    if generations:
                        for generation_group in generations:
                            for generation in generation_group:
                                text = _message_text(getattr(generation, "message", None))
                                if text:
                                    full_response += text
                                    await on_token(text)

    except asyncio.TimeoutError:
        await on_thinking("Agent timed out after tool execution; returning the completed tool result.")
    except Exception as exc:
        error_text = str(exc)
        if "tool call validation failed" in error_text and "was not in request.tools" in error_text:
            full_response = (
                "I can't modify files or run commands until a workspace folder is opened. "
                "Please open a folder in Developer mode first."
            )
            await on_token(full_response)
            return full_response
        raise

    if not full_response and last_tool_result:
        full_response = f"Done. {last_tool_result}"
        if last_tool_name:
            full_response = f"Done. {last_tool_name} completed: {last_tool_result}"
        await on_token(full_response)

    return full_response
