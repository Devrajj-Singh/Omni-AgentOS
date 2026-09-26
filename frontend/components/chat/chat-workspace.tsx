'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { agentStyle } from '@/lib/agent-styles'
import { sendChatMessage, cancelChatTask } from '@/services/api'
import { wsService } from '@/services/websocket'
import { useActivityStore } from '@/store/activity-store'
import { useApprovalStore } from '@/store/approval-store'
import { useChatStore } from '@/store/chat-store'
import { useDeveloperStore } from '@/store/developer-store'
import { useUIStore } from '@/store/ui-store'
import type { WSEvent, TaskGraph, TaskGraphStepStatus } from '@/types'
import { ApprovalBubble } from './approval-bubble'
import { ChatInput } from './chat-input'
import { MessageList } from './message-list'
import { ArtifactsPanel } from './artifacts-panel'
import { TaskGraphView } from './task-graph-view'

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
  decision: 'approved' | 'rejected' | 'timeout'
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
  if (
    event.payload.decision !== 'approved' &&
    event.payload.decision !== 'rejected' &&
    event.payload.decision !== 'timeout'
  ) {
    return null
  }
  return { approvalId: event.payload.approvalId, decision: event.payload.decision }
}

function getTaskGraphInitPayload(event: WSEvent): TaskGraph | null {
  if (
    typeof event.payload === 'object' &&
    event.payload !== null &&
    'steps' in event.payload &&
    Array.isArray((event.payload as { steps: unknown }).steps)
  ) {
    return event.payload as TaskGraph
  }
  return null
}

interface TaskGraphUpdatePayload {
  stepId: string
  status: TaskGraphStepStatus
  agent?: string
}

function getTaskGraphUpdatePayload(event: WSEvent): TaskGraphUpdatePayload | null {
  if (typeof event.payload !== 'object' || event.payload === null) return null
  const raw = event.payload as Record<string, unknown>
  const stepId = (raw.stepId ?? raw.step_id) as string | undefined
  const status = raw.status as TaskGraphStepStatus | undefined
  const agent = raw.agent as string | undefined
  if (!stepId || !status) return null
  return { stepId, status, agent }
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function ChatWorkspace(): JSX.Element {
  const messages = useChatStore((state) => state.messages)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const sessionId = useChatStore((state) => state.sessionId)
  const taskGraph = useChatStore((state) => state.taskGraph)
  const addEvent = useActivityStore((state) => state.addEvent)
  const workspacePath = useDeveloperStore((state) => state.workspace.rootPath)
  const activeFilePath = useDeveloperStore((state) => state.activeFilePath)
  const openedFiles = useDeveloperStore((state) => state.openedFiles)
  const autonomousMode = useUIStore((state) => state.autonomousMode)
  const artifactsPanelOpen = useUIStore((state) => state.artifactsPanelOpen)
  const artifactsPanelWidth = useUIStore((state) => state.artifactsPanelWidth)
  const artifactsPanelFullScreen = useUIStore((state) => state.artifactsPanelFullScreen)
  const approvals = useApprovalStore((state) => state.pendingApprovals)
  const assistantMessageIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [draft, setDraft] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const recentlyOpenedFiles = useMemo(
    () => openedFiles.map((file) => file.path),
    [openedFiles]
  )

  useEffect(() => {
    const unsubStart = wsService.on('task.start', (event) => {
      const payload = getTaskStartPayload(event)
      if (!payload) return

      assistantMessageIdRef.current = payload.messageId
      useChatStore.getState().clearTaskGraph()
      useChatStore.getState().startAssistantMessage(payload.messageId)
      addEvent({ label: '[Groq]', message: 'Streaming response...', status: 'running' })
    })

    const unsubToken = wsService.on('token', (event) => {
      if (!useChatStore.getState().isStreaming || !assistantMessageIdRef.current) return
      const payload = getTokenPayload(event)
      if (!payload) return

      useChatStore.getState().appendToken(payload.text)
    })

    const unsubComplete = wsService.on('task.complete', () => {
      if (!useChatStore.getState().isStreaming && !assistantMessageIdRef.current) return
      assistantMessageIdRef.current = null
      useChatStore.getState().finalizeMessage()
      useChatStore.getState().setStreaming(false)
      useChatStore.getState().setCurrentTaskId(null)
      addEvent({ label: '[Chat]', message: 'Complete', status: 'done' })
    })

    const unsubError = wsService.on('error', (event) => {
      if (!useChatStore.getState().isStreaming && !assistantMessageIdRef.current) return
      const payload = getErrorPayload(event)
      const message = payload?.message ?? 'Unknown streaming error'
      useChatStore.getState().setError(assistantMessageIdRef.current ?? '', message)
      assistantMessageIdRef.current = null
      useChatStore.getState().setStreaming(false)
      useChatStore.getState().setCurrentTaskId(null)
      addEvent({ label: '[Error]', message, status: 'error' })
    })

    const unsubToolCall = wsService.on('tool.call', (event) => {
      if (!useChatStore.getState().isStreaming || !assistantMessageIdRef.current) return
      const payload = getToolCallPayload(event)
      if (!payload) return

      const msgId = assistantMessageIdRef.current
      if (msgId) {
        useChatStore.getState().addToolCall(msgId, payload.tool, payload.args)
      }

      addEvent({
        label: '[Tool]',
        message: `${payload.tool}(${JSON.stringify(payload.args).slice(0, 60)}...)`,
        status: 'running',
      })
    })

    const unsubToolResult = wsService.on('tool.result', (event) => {
      if (!useChatStore.getState().isStreaming || !assistantMessageIdRef.current) return
      const payload = getToolResultPayload(event)
      if (!payload) return

      const msgId = assistantMessageIdRef.current
      if (msgId) {
        useChatStore.getState().updateToolResult(msgId, payload.tool, payload.result)
      }

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
      if (!useChatStore.getState().isStreaming) return
      const payload = getThinkingPayload(event)
      if (!payload) return

      addEvent({
        label: '[Agent]',
        message: payload.reasoning.slice(0, 100),
        status: 'running',
      })
    })

    const unsubAgentHandoff = wsService.on('agent.handoff', (event) => {
      if (!useChatStore.getState().isStreaming) return
      const payload = getAgentHandoffPayload(event)
      if (!payload) return

      const style = agentStyle(payload.toAgent)
      addEvent({
        label: `[${style.label}]`,
        message: payload.reason,
        status: 'running',
      })

      const msgId = assistantMessageIdRef.current
      if (msgId) {
        useChatStore.getState().setMessageAgentName(msgId, style.label)
      }
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
      const label =
        payload.decision === 'approved' ? 'Approved' :
        payload.decision === 'timeout' ? 'Timed out' : 'Rejected'
      addEvent({
        label: '[Approval]',
        message: `${label}: ${payload.approvalId.slice(0, 8)}`,
        status: payload.decision === 'approved' ? 'done' : 'error',
      })
    })

    const unsubTaskGraphInit = wsService.on('agent.task_graph_init', (event) => {
      const payload = getTaskGraphInitPayload(event)
      if (!payload) return

      useChatStore.getState().setTaskGraph(payload)
      addEvent({
        label: '[Plan]',
        message: `Plan: ${payload.project_name || 'Project'} (${payload.steps.length} steps)`,
        status: 'running',
      })
    })

    const unsubTaskGraphUpdate = wsService.on('agent.task_graph_update', (event) => {
      const payload = getTaskGraphUpdatePayload(event)
      if (!payload) return

      useChatStore.getState().updateTaskGraphStep(payload.stepId, payload.status, payload.agent)
      addEvent({
        label: '[Step]',
        message: `${payload.stepId}: ${payload.status}${payload.agent ? ` (${payload.agent})` : ''}`,
        status: payload.status === 'done' ? 'done' : payload.status === 'failed' ? 'error' : 'running',
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
      unsubTaskGraphInit()
      unsubTaskGraphUpdate()
    }
  }, [addEvent])

  const handleStopGenerating = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    const taskId = useChatStore.getState().currentTaskId
    assistantMessageIdRef.current = null
    
    useChatStore.getState().stopStreaming()
    addEvent({ label: '[Chat]', message: 'Generation stopped by user.', status: 'error' })

    if (taskId) {
      try {
        await cancelChatTask(taskId)
      } catch (e) {
        console.error('Failed to cancel chat task', e)
      }
    }
  }, [addEvent])

  const handleSend = useCallback(
    async (content: string): Promise<void> => {
      const conversationHistory = useChatStore.getState().messages

      useChatStore.getState().addUserMessage(content)
      addEvent({ label: '[Chat]', message: 'Sending message...', status: 'running' })
      useChatStore.getState().setStreaming(true)

      try {
        const controller = new AbortController()
        abortControllerRef.current = controller

        const { task_id } = await sendChatMessage(
          sessionId,
          content,
          conversationHistory,
          workspacePath,
          activeFilePath,
          autonomousMode,
          recentlyOpenedFiles,
          controller.signal
        )
        useChatStore.getState().setCurrentTaskId(task_id)
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Chat request aborted by user')
          return
        }
        const message = stringifyError(error)
        useChatStore.getState().setError('', message)
        useChatStore.getState().setStreaming(false)
        useChatStore.getState().setCurrentTaskId(null)
        addEvent({ label: '[Error]', message, status: 'error' })
      } finally {
        abortControllerRef.current = null
      }
    },
    [activeFilePath, addEvent, autonomousMode, recentlyOpenedFiles, sessionId, workspacePath]
  )

  const handleRegenerate = useCallback(
    (messageId: string) => {
      const msgs = useChatStore.getState().messages
      const index = msgs.findIndex((m) => m.id === messageId)
      if (index === -1) return

      let userMsgIndex = -1
      for (let i = index; i >= 0; i--) {
        if (msgs[i].role === 'user') {
          userMsgIndex = i
          break
        }
      }
      if (userMsgIndex === -1) return

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      const userMsg = msgs[userMsgIndex]
      useChatStore.getState().truncateMessages(userMsg.id)
      handleSend(userMsg.content)
    },
    [handleSend]
  )

  const handleEditSubmit = useCallback(
    (messageId: string, newContent: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      useChatStore.getState().truncateMessages(messageId)
      handleSend(newContent)
    },
    [handleSend]
  )

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const startX = e.pageX
    const startWidth = panelRef.current ? panelRef.current.offsetWidth : artifactsPanelWidth
    let currentWidth = startWidth

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    let animationFrameId: number | null = null

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.pageX
      const minWidth = 320
      const maxWidth = Math.floor(window.innerWidth * 0.85)
      currentWidth = Math.max(minWidth, Math.min(startWidth + delta, maxWidth))

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }

      animationFrameId = requestAnimationFrame(() => {
        if (panelRef.current) {
          panelRef.current.style.width = `${currentWidth}px`
        }
      })
    }

    const onMouseUp = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setIsDragging(false)
      useUIStore.getState().setArtifactsPanelWidth(currentWidth)

      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [artifactsPanelWidth])

  return (
    <div className="flex h-full w-full bg-transparent overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessageList 
          messages={messages} 
          onSuggestionClick={setDraft}
          onRegenerate={handleRegenerate}
          onEditSubmit={handleEditSubmit}
        />
        {taskGraph && (
          <div className="px-4 py-2 shrink-0 max-w-3xl mx-auto w-full">
            <TaskGraphView taskGraph={taskGraph} />
          </div>
        )}
        <div>
          {approvals.map((approval) => (
            <ApprovalBubble key={approval.approvalId} approval={approval} />
          ))}
        </div>
        <div className="px-4 pb-4 pt-2 shrink-0">
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
            onStop={handleStopGenerating}
            disabled={isStreaming}
            value={draft}
            onValueChange={setDraft}
            contextLabel={activeFilePath ? activeFilePath.split(/[/\\]/).pop() : undefined}
          />
        </div>
      </div>
      
      {artifactsPanelOpen && (
        <div 
          ref={panelRef}
          className={`shrink-0 border-l border-border-default flex relative ${
            isDragging ? 'transition-none select-none' : 'transition-all duration-300 ease-in-out'
          } ${artifactsPanelFullScreen ? 'fixed inset-0 z-50 bg-bg-base' : ''}`} 
          style={{ width: artifactsPanelFullScreen ? '100%' : `${artifactsPanelWidth}px` }}
        >
          {!artifactsPanelFullScreen && (
            <div
              className="group absolute -left-1.5 top-0 bottom-0 z-30 flex w-3 cursor-col-resize items-center justify-center"
              onMouseDown={handleMouseDown}
            >
              <div
                className={`h-full w-1 transition-colors ${
                  isDragging ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/60'
                }`}
              />
            </div>
          )}
          <ArtifactsPanel />
        </div>
      )}
    </div>
  )
}

export default ChatWorkspace
