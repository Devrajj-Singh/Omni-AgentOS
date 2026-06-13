'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { ChatInput } from '@/components/chat/chat-input'
import { MessageBubble } from '@/components/chat/message-bubble'
import { sendChatMessage } from '@/services/api'
import { wsService } from '@/services/websocket'
import { useActivityStore } from '@/store/activity-store'
import { useChatStore } from '@/store/chat-store'
import { useDeveloperStore } from '@/store/developer-store'
import type { Message, WSEvent } from '@/types'

interface ResearchChatProps {
  documentCount: number
}

interface TaskStartPayload {
  messageId: string
}

interface TokenPayload {
  text: string
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

const suggestions = [
  'Search for latest AI news',
  'What does this codebase do?',
  'Find documentation for React hooks',
  'Summarize uploaded documents',
]

function hasStringProperty(payload: unknown, key: string): payload is Record<string, string> {
  return typeof payload === 'object' && payload !== null && key in payload && typeof payload[key as keyof typeof payload] === 'string'
}

function getTaskStartPayload(event: WSEvent): TaskStartPayload | null {
  return hasStringProperty(event.payload, 'messageId') ? { messageId: event.payload.messageId } : null
}

function getTokenPayload(event: WSEvent): TokenPayload | null {
  return hasStringProperty(event.payload, 'text') ? { text: event.payload.text } : null
}

function getToolCallPayload(event: WSEvent): ToolCallPayload | null {
  if (!hasStringProperty(event.payload, 'tool')) return null
  const args =
    typeof event.payload === 'object' &&
    event.payload !== null &&
    'args' in event.payload &&
    typeof event.payload.args === 'object' &&
    event.payload.args !== null
      ? (event.payload.args as Record<string, unknown>)
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

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function ResearchMessageList({
  messages,
  documentCount,
  onSuggestionClick,
}: {
  messages: Message[]
  documentCount: number
  onSuggestionClick: (suggestion: string) => void
}): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)
  const previousMessageCountRef = useRef(0)

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    const isNewMessage = messages.length > previousMessageCountRef.current
    const behavior: ScrollBehavior = isNewMessage || !lastMessage?.isStreaming ? 'smooth' : 'instant'

    bottomRef.current?.scrollIntoView({ behavior })
    previousMessageCountRef.current = messages.length
  }, [messages])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-4">
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-4 animate-fade-up sm:gap-4 sm:px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
            <Search className="h-5 w-5 text-accent" />
          </div>
          <div className="text-center">
            <h2 className="mb-1 text-base font-semibold text-text-primary">Research Assistant</h2>
            <p className="max-w-xs text-sm text-text-muted">
              {documentCount > 0
                ? `${documentCount} document${documentCount > 1 ? 's' : ''} loaded. Ask anything about them, or search the web.`
                : 'Upload documents or ask me to search the web for information.'}
            </p>
          </div>
          <div className="hidden max-w-sm flex-wrap justify-center gap-2 sm:flex">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="rounded-full border border-border-default bg-bg-surface px-3 py-1.5 text-xs text-text-secondary transition-all duration-150 hover:border-accent/30 hover:bg-accent/5 hover:text-accent"
                onClick={() => onSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={bottomRef} className="h-1" />
        </>
      )}
    </div>
  )
}

export function ResearchChat({ documentCount }: ResearchChatProps): JSX.Element {
  const messages = useChatStore((state) => state.messages)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const sessionId = useChatStore((state) => state.sessionId)
  const addEvent = useActivityStore((state) => state.addEvent)
  const workspacePath = useDeveloperStore((state) => state.workspace.rootPath)
  const activeFilePath = useDeveloperStore((state) => state.activeFilePath)
  const assistantMessageIdRef = useRef<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const unsubStart = wsService.on('task.start', (event) => {
      const payload = getTaskStartPayload(event)
      if (!payload) return

      assistantMessageIdRef.current = payload.messageId
      useChatStore.getState().startAssistantMessage(payload.messageId)
      addEvent({ label: '[Groq]', message: 'Streaming research response...', status: 'running' })
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
      const message = hasStringProperty(event.payload, 'message')
        ? event.payload.message
        : 'Unknown streaming error'
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

    return () => {
      unsubStart()
      unsubToken()
      unsubComplete()
      unsubError()
      unsubToolCall()
      unsubToolResult()
      unsubThinking()
    }
  }, [addEvent])

  const handleSend = useCallback(
    async (content: string): Promise<void> => {
      const conversationHistory = useChatStore.getState().messages

      useChatStore.getState().addUserMessage(content)
      addEvent({ label: '[Chat]', message: 'Sending research message...', status: 'running' })
      useChatStore.getState().setStreaming(true)

      try {
        const { task_id } = await sendChatMessage(
          sessionId,
          content,
          conversationHistory,
          workspacePath,
          activeFilePath
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
    [activeFilePath, addEvent, sessionId, workspacePath]
  )

  return (
    <div className="flex h-full flex-col bg-transparent">
      <ResearchMessageList
        messages={messages}
        documentCount={documentCount}
        onSuggestionClick={setDraft}
      />
      <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          value={draft}
          onValueChange={setDraft}
          contextLabel={documentCount > 0 ? `${documentCount} research documents` : undefined}
        />
      </div>
    </div>
  )
}

export default ResearchChat
