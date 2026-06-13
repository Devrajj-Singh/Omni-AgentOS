export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming: boolean
  createdAt: string // ISO 8601
  error?: string
}
