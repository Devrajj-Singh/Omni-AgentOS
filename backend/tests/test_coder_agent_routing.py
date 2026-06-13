"""Tests for coder agent request routing."""

import asyncio

from agents.coder_agent import _build_tools, _is_document_query


def test_create_file_is_not_document_query():
    assert _is_document_query("create a readme.md file in backend folder") is False


def test_uploaded_document_summary_is_document_query():
    assert _is_document_query("summarize the uploaded pdf") is True


def test_generic_file_summary_is_document_query():
    assert _is_document_query("what does this file say") is True


def test_workspace_action_tools_exclude_document_search():
    async def on_approval_required(*args):
        return None

    loop = asyncio.new_event_loop()
    try:
        tools = _build_tools(
            workspace_root="C:/workspace",
            autonomous_mode=False,
            on_approval_required=on_approval_required,
            approval_loop=loop,
            allow_document_search=_is_document_query("create a readme.md file in root"),
        )
    finally:
        loop.close()

    tool_names = {tool.name for tool in tools}
    assert "search_documents" not in tool_names
    assert "write_file_tool" in tool_names
