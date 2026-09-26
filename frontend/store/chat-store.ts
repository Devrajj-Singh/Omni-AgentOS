import { create } from 'zustand'
import type { Message } from '@/types'

const SESSION_STORAGE_KEY = 'omni-session-id'

const getSessionId = (): string => {
  if (typeof window === 'undefined') return ''
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (stored) return stored
  const id = crypto.randomUUID()
  sessionStorage.setItem(SESSION_STORAGE_KEY, id)
  return id
}

interface ChatState {
  sessionId: string
  messages: Message[]
  isStreaming: boolean
  currentTaskId: string | null
}

interface ChatActions {
  addUserMessage: (content: string) => Message
  startAssistantMessage: (messageId: string) => void
  appendToken: (text: string) => void
  finalizeMessage: () => void
  setError: (messageId: string, error: string) => void
  setStreaming: (value: boolean) => void
  stopStreaming: () => void
  setCurrentTaskId: (taskId: string | null) => void
  clearMessages: () => void
  setMessageAgentName: (id: string, agentName: string) => void
  addToolCall: (messageId: string, tool: string, args: Record<string, unknown>) => void
  updateToolResult: (messageId: string, tool: string, result: string) => void
  truncateMessages: (messageId: string) => void
}

type ChatStore = ChatState & ChatActions

export const useChatStore = create<ChatStore>()((set) => ({
  sessionId: getSessionId(),
  messages: [],
  isStreaming: false,
  currentTaskId: null,

  addUserMessage: (content) => {
    const message: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      isStreaming: false,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ messages: [...state.messages, message] }))
    return message
  },

  startAssistantMessage: (messageId) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: messageId,
          role: 'assistant',
          content: '',
          isStreaming: true,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  appendToken: (text) =>
    set((state) => ({
      messages: state.messages.map((msg, index) =>
        index === state.messages.length - 1 && msg.isStreaming
          ? { ...msg, content: msg.content + text }
          : msg
      ),
    })),

  finalizeMessage: () =>
    set((state) => ({
      messages: state.messages
        .map((msg, index) => {
          if (index === state.messages.length - 1 && msg.isStreaming) {
            if (!msg.content?.trim() && (!msg.toolCalls || msg.toolCalls.length === 0)) {
              return null
            }
            return { ...msg, isStreaming: false }
          }
          return msg
        })
        .filter((msg): msg is Message => msg !== null),
    })),

  setError: (messageId, error) =>
    set((state) => {
      if (!messageId) {
        const fallbackMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          isStreaming: false,
          createdAt: new Date().toISOString(),
          error,
        }
        return { messages: [...state.messages, fallbackMessage] }
      }

      return {
        messages: state.messages.map((msg) =>
          msg.id === messageId ? { ...msg, error, isStreaming: false } : msg
        ),
      }
    }),

  setStreaming: (value) => set({ isStreaming: value }),

  stopStreaming: () =>
    set((state) => {
      const messages = state.messages
        .map((msg, index) => {
          const isLast = index === state.messages.length - 1
          if (msg.role === 'assistant' && (msg.isStreaming || isLast)) {
            // Discard empty assistant message with no tool calls when stopped
            if (!msg.content?.trim() && (!msg.toolCalls || msg.toolCalls.length === 0)) {
              return null
            }
            return { ...msg, isStreaming: false }
          }
          return msg
        })
        .filter((msg): msg is Message => msg !== null)

      return {
        messages,
        isStreaming: false,
        currentTaskId: null,
      }
    }),

  setCurrentTaskId: (taskId) => set({ currentTaskId: taskId }),

  clearMessages: () => set({ messages: [], currentTaskId: null, isStreaming: false }),

  setMessageAgentName: (id, agentName) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, agentName } : msg
      ),
    })),

  addToolCall: (messageId, tool, args) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              toolCalls: [
                ...(msg.toolCalls || []),
                { tool, args, status: 'running' as const },
              ],
            }
          : msg
      ),
    })),

  updateToolResult: (messageId, tool, result) =>
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId || !msg.toolCalls) return msg
        
        // Find the last running tool call with matching name
        const toolCalls = [...msg.toolCalls]
        for (let i = toolCalls.length - 1; i >= 0; i--) {
          if (toolCalls[i].tool === tool && toolCalls[i].status === 'running') {
            toolCalls[i] = { ...toolCalls[i], result, status: 'done' }
            break
          }
        }
        return { ...msg, toolCalls }
      }),
    })),

  truncateMessages: (messageId) =>
    set((state) => {
      const index = state.messages.findIndex((m) => m.id === messageId)
      if (index === -1) return state
      return { messages: state.messages.slice(0, index) }
    }),
}))

export default useChatStore
