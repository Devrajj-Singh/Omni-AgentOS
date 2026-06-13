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
  setCurrentTaskId: (taskId: string | null) => void
  clearMessages: () => void
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
      messages: state.messages.map((msg, index) =>
        index === state.messages.length - 1 && msg.isStreaming
          ? { ...msg, isStreaming: false }
          : msg
      ),
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

  setCurrentTaskId: (taskId) => set({ currentTaskId: taskId }),

  clearMessages: () => set({ messages: [], currentTaskId: null, isStreaming: false }),
}))

export default useChatStore
