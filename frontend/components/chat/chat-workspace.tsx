'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { agentStyle } from '@/lib/agent-styles'
import { sendChatMessage } from '@/services/api'
import { wsService } from '@/services/websocket'
import { useActivityStore } from '@/store/activity-store'
import { useApprovalStore } from '@/store/approval-store'
import { useChatStore } from '@/store/chat-store'
import { useDeveloperStore } from '@/store/developer-store'
import { useUIStore } from '@/store/ui-store'
import type { WSEvent } from '@/types'
import { ApprovalBubble } from './approval-bubble'
import { ChatInput } from './chat-input'
import { MessageList } from './message-list'

interface TaskStartPayload {
  messageId: string
}

interface TokenPayload {
  text: string
}

interface ErrorPayload {
  message: string
  canRetry: boolean
}

interface ToolCallPayload {
  tool: string
  args: Record<string, unknown>
}

interface ToolResultPayload {
  tool: string
  result: string
}

interface ThinkingPayload {
  reasoning: string
}

interface AgentHandoffPayload {
  fromAgent: string | null
  toAgent: string
  reason: string
}

interface ApprovalRequiredPayload {
  approvalId: string
  tool: string
  args: Record<string, unknown>
  description: string
  riskLevel: 'low' | 'medium' | 'high'
}

interface ApprovalResolvedPayload {
  approvalId: string
  decision: 'approved' | 'rejected'
}

function hasStringProperty(payload: unknown, key: string): payload is Record<string, string> {
  return typeof payload === 'object' && payload !== null && key in payload && typeof payload[key as keyof typeof payload] === 'string'
}

function getTaskStartPayload(event: WSEvent): TaskStartPayload | null {
  return hasStringProperty(event.payload, 'messageId') ? { messageId: event.payload.messageId } : null
}

function getTokenPayload(event: WSEvent): TokenPayload | null {
  return hasStringProperty(event.payload, 'text') ? { text: event.payload.text } : null
}

function getErrorPayload(event: WSEvent): ErrorPayload | null {
  if (!hasStringProperty(event.payload, 'message')) return null
  const canRetry =
    typeof event.payload === 'object' &&
    event.payload !== null &&
    'canRetry' in event.payload &&
    typeof event.payload.canRetry === 'boolean'
      ? event.payload.canRetry
      : false
  return { message: event.payload.message, canRetry }
}

function getToolCallPayload(event: WSEvent): ToolCallPayload | null {
  if (!hasStringProperty(event.payload, 'tool')) return null
  const args =
    typeof event.payload === 'object' &&
    event.payload !== null &&
    'args' in event.payload &&
    typeof event.payload.args === 'object' &&
    event.payload.args !== null
      ? event.payload.args as Record<string, unknown>
      : {}
  return { tool: event.payload.tool, args }
}

function getToolResultPayload(event: WSEvent): ToolResultPayload | null {
  if (!hasStringProperty(event.payload, 'tool') || !hasStringProperty(event.payload, 'result')) {
    return null
  }
  return { tool: event.payload.tool, result: event.payload.result }
}

function getThinkingPayload(event: WSEvent): ThinkingPayload | null {
  return hasStringProperty(event.payload, 'reasoning') ? { reasoning: event.payload.reasoning } : null
}

function getAgentHandoffPayload(event: WSEvent): AgentHandoffPayload | null {
  if (!hasStringProperty(event.payload, 'toAgent') || !hasStringProperty(event.payload, 'reason')) {
    return null
  }
  const fromAgent =
    typeof event.payload === 'object' &&
    event.payload !== null &&
    'fromAgent' in event.payload &&
    typeof event.payload.fromAgent === 'string'
      ? event.payload.fromAgent
      : null
  return { fromAgent, toAgent: event.payload.toAgent, reason: event.payload.reason }
}

function getEventTaskId(event: WSEvent): string {
  const rawEvent = event as WSEvent & { task_id?: string }
  return event.taskId ?? rawEvent.task_id ?? ''
}

function getApprovalRequiredPayload(event: WSEvent): ApprovalRequiredPayload | null {
  if (
    !hasStringProperty(event.payload, 'approvalId') ||
    !hasStringProperty(event.payload, 'tool') ||
    !hasStringProperty(event.payload, 'description') ||
    !hasStringProperty(event.payload, 'riskLevel')
  ) {
    return null
  }

  const args =
    typeof event.payload === 'object' &&
    event.payload !== null &&
    'args' in event.payload &&
    typeof event.payload.args === 'object' &&
    event.payload.args !== null
      ? event.payload.args as Record<string, unknown>
      : {}

  return {
    approvalId: event.payload.approvalId,
    tool: event.payload.tool,
    args,
    description: event.payload.description,
    riskLevel: event.payload.riskLevel as ApprovalRequiredPayload['riskLevel'],
  }
}

function getApprovalResolvedPayload(event: WSEvent): ApprovalResolvedPayload | null {
  if (!hasStringProperty(event.payload, 'approvalId') || !hasStringProperty(event.payload, 'decision')) {
    return null
  }
  if (event.payload.decision !== 'approved' && event.payload.decision !== 'rejected') return null
  return { approvalId: event.payload.approvalId, decision: event.payload.decision }
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function ChatWorkspace(): JSX.Element {
  const messages = useChatStore((state) => state.messages)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const sessionId = useChatStore((state) => state.sessionId)
  const addEvent = useActivityStore((state) => state.addEvent)
  const workspacePath = useDeveloperStore((state) => state.workspace.rootPath)
  const activeFilePath = useDeveloperStore((state) => state.activeFilePath)
  const autonomousMode = useUIStore((state) => state.autonomousMode)
  const approvals = useApprovalStore((state) => state.pendingApprovals)
  const assistantMessageIdRef = useRef<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const unsubStart = wsService.on('task.start', (event) => {
      const payload = getTaskStartPayload(event)
      if (!payload) return

      assistantMessageIdRef.current = payload.messageId
      useChatStore.getState().startAssistantMessage(payload.messageId)
      addEvent({ label: '[Groq]', message: 'Streaming response...', status: 'running' })
    })

    const unsubToken = wsService.on('token', (event) => {
      const payload = getTokenPayload(event)
      if (!payload) return

      useChatStore.getState().appendToken(payload.text)
    })

    const unsubComplete = wsService.on('task.complete', () => {
      assistantMessageIdRef.current = null
      useChatStore.getState().finalizeMessage()
      useChatStore.getState().setStreaming(false)
      useChatStore.getState().setCurrentTaskId(null)
      addEvent({ label: '[Chat]', message: 'Complete', status: 'done' })
    })

    const unsubError = wsService.on('error', (event) => {
      const payload = getErrorPayload(event)
      const message = payload?.message ?? 'Unknown streaming error'
      useChatStore.getState().setError(assistantMessageIdRef.current ?? '', message)
      assistantMessageIdRef.current = null
      useChatStore.getState().setStreaming(false)
      useChatStore.getState().setCurrentTaskId(null)
      addEvent({ label: '[Error]', message, status: 'error' })
    })

    const unsubToolCall = wsService.on('tool.call', (event) => {
      const payload = getToolCallPayload(event)
      if (!payload) return

      addEvent({
        label: '[Tool]',
        message: `${payload.tool}(${JSON.stringify(payload.args).slice(0, 60)}...)`,
        status: 'running',
      })
    })

    const unsubToolResult = wsService.on('tool.result', (event) => {
      const payload = getToolResultPayload(event)
      if (!payload) return

      if (payload.tool === 'write_file_tool' || payload.tool === 'run_command_tool') {
        const { pendingApprovals, completeApproval } = useApprovalStore.getState()
        const matchingApproval = [...pendingApprovals]
          .reverse()
          .find(
            (approval) =>
              approval.status === 'approved' &&
              approval.tool === payload.tool &&
              approval.taskId === getEventTaskId(event)
          )

        if (matchingApproval) {
          completeApproval(matchingApproval.approvalId)
        }
      }

      addEvent({
        label: '[Tool]',
        message: `${payload.tool} -> ${payload.result.slice(0, 80)}`,
        status: 'done',
      })
    })

    const unsubThinking = wsService.on('agent.thinking', (event) => {
      const payload = getThinkingPayload(event)
      if (!payload) return

      addEvent({
        label: '[Agent]',
        message: payload.reasoning.slice(0, 100),
        status: 'running',
      })
    })

    const unsubAgentHandoff = wsService.on('agent.handoff', (event) => {
      const payload = getAgentHandoffPayload(event)
      if (!payload) return

      const style = agentStyle(payload.toAgent)
      addEvent({
        label: `[${style.label}]`,
        message: payload.reason,
        status: 'running',
      })
    })

    const unsubApprovalRequired = wsService.on('approval.required', (event) => {
      const payload = getApprovalRequiredPayload(event)
      if (!payload) return

      useApprovalStore.getState().addApproval({
        approvalId: payload.approvalId,
        tool: payload.tool,
        args: payload.args,
        description: payload.description,
        riskLevel: payload.riskLevel,
        taskId: getEventTaskId(event),
        status: 'pending',
      })
      addEvent({
        label: '[Approval]',
        message: `Waiting for approval: ${payload.description}`,
        status: 'running',
      })
    })

    const unsubApprovalResolved = wsService.on('approval.resolved', (event) => {
      const payload = getApprovalResolvedPayload(event)
      if (!payload) return

      useApprovalStore.getState().resolveApproval(payload.approvalId, payload.decision)
      addEvent({
        label: '[Approval]',
        message: `${payload.decision === 'approved' ? 'Approved' : 'Rejected'}: ${payload.approvalId.slice(0, 8)}`,
        status: payload.decision === 'approved' ? 'done' : 'error',
      })
    })

    return () => {
      unsubStart()
      unsubToken()
      unsubComplete()
      unsubError()
      unsubToolCall()
      unsubToolResult()
      unsubThinking()
      unsubAgentHandoff()
      unsubApprovalRequired()
      unsubApprovalResolved()
    }
  }, [addEvent])

  const handleSend = useCallback(
    async (content: string): Promise<void> => {
      const conversationHistory = useChatStore.getState().messages

      useChatStore.getState().addUserMessage(content)
      addEvent({ label: '[Chat]', message: 'Sending message...', status: 'running' })
      useChatStore.getState().setStreaming(true)

      try {
        const { task_id } = await sendChatMessage(
          sessionId,
          content,
          conversationHistory,
          workspacePath,
          activeFilePath,
          autonomousMode
        )
        useChatStore.getState().setCurrentTaskId(task_id)
      } catch (error) {
        const message = stringifyError(error)
        useChatStore.getState().setError('', message)
        useChatStore.getState().setStreaming(false)
        useChatStore.getState().setCurrentTaskId(null)
        addEvent({ label: '[Error]', message, status: 'error' })
      }
    },
    [activeFilePath, addEvent, autonomousMode, sessionId, workspacePath]
  )

  return (
    <div className="flex h-full flex-col bg-transparent">
      <MessageList messages={messages} onSuggestionClick={setDraft} />
      <div>
        {approvals.map((approval) => (
          <ApprovalBubble key={approval.approvalId} approval={approval} />
        ))}
      </div>
      <div className="px-4 pb-4 pt-2">
        {workspacePath && (
          <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
            <FolderOpen className="h-3 w-3 shrink-0 text-accent" />
            <span className="truncate">{workspacePath.split(/[/\\]/).pop()}</span>
            {activeFilePath && (
              <>
                <span className="text-text-disabled">·</span>
                <span className="truncate text-accent">
                  {activeFilePath.split(/[/\\]/).pop()}
                </span>
              </>
            )}
          </div>
        )}
        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          value={draft}
          onValueChange={setDraft}
          contextLabel={activeFilePath ? activeFilePath.split(/[/\\]/).pop() : undefined}
        />
      </div>
    </div>
  )
}

export default ChatWorkspace
