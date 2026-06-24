"""Chat API endpoint for initiating streaming chat turns."""
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks

from agents.orchestrator import run_orchestrated
from context.workspace_context import build_project_context
from dependencies.session_store import session_store
from memory.store import memory_store
from models.chat import ChatRequest, ChatResponse
from models.message import Message
from models.ws_event import WSEvent, WSEventType
from observability.logger import log_event
from websocket.manager import manager

router = APIRouter()


async def orchestrate_streaming(
    session_id: str,
    task_id: str,
    user_message: Message,
    conversation_history: list[Message],
    workspace_path: str | None,
    active_file_path: str | None,
    autonomous_mode: bool,
    recently_opened_files: list[str] | None = None,
) -> None:
    """Run the LangGraph agent and stream all events over WebSocket."""
    message_id = str(uuid.uuid4())

    try:
        # Emit task.start WSEvent
        await manager.send_event(
            session_id,
            WSEvent(
                type=WSEventType.TASK_START,
                task_id=task_id,
                payload={"messageId": message_id},
                timestamp=datetime.utcnow()
            )
        )

        history_dicts = [
            {"role": msg.role, "content": msg.content}
            for msg in conversation_history
        ]

        memory_context = memory_store.get_relevant_context(
            query=user_message.content,
            n_results=3,
        )
        project_context = build_project_context(
            workspace_root=workspace_path,
            active_file_path=active_file_path,
            recently_opened_files=recently_opened_files,
        )

        if project_context:
            log_event(
                "project_context_built",
                task_id,
                agent=None,
                workspace=workspace_path,
                has_deps=bool(project_context),
            )

        async def on_token(text: str) -> None:
            await manager.send_event(
                session_id,
                WSEvent(
                    type=WSEventType.TOKEN,
                    task_id=task_id,
                    payload={"text": text},
                    timestamp=datetime.utcnow()
                )
            )

        async def on_tool_call(tool_name: str, args: dict) -> None:
            await manager.send_event(
                session_id,
                WSEvent(
                    type=WSEventType.TOOL_CALL,
                    task_id=task_id,
                    payload={"tool": tool_name, "args": args},
                    timestamp=datetime.utcnow()
                )
            )

        async def on_tool_result(tool_name: str, result: str) -> None:
            await manager.send_event(
                session_id,
                WSEvent(
                    type=WSEventType.TOOL_RESULT,
                    task_id=task_id,
                    payload={"tool": tool_name, "result": result},
                    timestamp=datetime.utcnow()
                )
            )

        async def on_thinking(reasoning: str) -> None:
            await manager.send_event(
                session_id,
                WSEvent(
                    type=WSEventType.AGENT_THINKING,
                    task_id=task_id,
                    payload={"reasoning": reasoning},
                    timestamp=datetime.utcnow()
                )
            )

        async def on_approval_required(
            approval_id: str,
            tool_name: str,
            args: dict,
            description: str,
            risk_level: str,
        ) -> None:
            await manager.send_event(
                session_id,
                WSEvent(
                    type=WSEventType.APPROVAL_REQUIRED,
                    task_id=task_id,
                    payload={
                        "approvalId": approval_id,
                        "tool": tool_name,
                        "args": args,
                        "description": description,
                        "riskLevel": risk_level,
                    },
                    timestamp=datetime.utcnow()
                )
            )

        async def on_handoff(from_agent: str | None, to_agent: str, reason: str) -> None:
            await manager.send_event(
                session_id,
                WSEvent(
                    type=WSEventType.AGENT_HANDOFF,
                    task_id=task_id,
                    payload={
                        "fromAgent": from_agent,
                        "toAgent": to_agent,
                        "reason": reason,
                    },
                    timestamp=datetime.utcnow()
                )
            )

        full_response = await run_orchestrated(
            message=user_message.content,
            conversation_history=history_dicts,
            workspace_root=workspace_path,
            active_file_path=active_file_path,
            memory_context=memory_context,
            project_context=project_context,
            autonomous_mode=autonomous_mode,
            task_id=task_id,
            on_token=on_token,
            on_tool_call=on_tool_call,
            on_tool_result=on_tool_result,
            on_thinking=on_thinking,
            on_approval_required=on_approval_required,
            on_handoff=on_handoff,
        )

        assistant_message = Message(
            id=message_id,
            role="assistant",
            content=full_response,
            is_streaming=False
        )

        session_store.append_messages(session_id, [user_message, assistant_message])

        memory_store.save_turn(
            session_id=session_id,
            user_message=user_message.content,
            assistant_message=full_response,
            workspace_path=workspace_path,
        )

        await manager.send_event(
            session_id,
            WSEvent(
                type=WSEventType.TASK_COMPLETE,
                task_id=task_id,
                payload={"taskId": task_id, "messageCount": 2},
                timestamp=datetime.utcnow()
            )
        )

    except Exception as e:
        await manager.send_event(
            session_id,
            WSEvent(
                type=WSEventType.ERROR,
                task_id=task_id,
                payload={"message": str(e), "canRetry": True},
                timestamp=datetime.utcnow()
            )
        )


@router.post("/api/v1/chat", response_model=ChatResponse, status_code=202)
async def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks
) -> ChatResponse:
    """
    Initiate a streaming chat turn.
    
    Returns 202 immediately with task_id.
    Streaming happens in background via WebSocket.
    
    Args:
        request: ChatRequest containing session_id, message, and conversation_history
        background_tasks: FastAPI BackgroundTasks for async streaming
    
    Returns:
        ChatResponse with task_id and status="streaming"
    """
    # Generate unique task ID
    task_id = str(uuid.uuid4())
    
    # Create user message object
    user_message = Message(
        role="user",
        content=request.message
    )
    
    # Add streaming orchestration as background task
    background_tasks.add_task(
        orchestrate_streaming,
        session_id=request.session_id,
        task_id=task_id,
        user_message=user_message,
        conversation_history=request.conversation_history,
        workspace_path=request.workspace_path,
        active_file_path=request.active_file_path,
        autonomous_mode=request.autonomous_mode,
        recently_opened_files=request.recently_opened_files,
    )
    
    # Return 202 immediately
    return ChatResponse(task_id=task_id, status="streaming")
