export interface ToolCall {
  tool: string
  args: Record<string, unknown>
  result?: string
  status: 'running' | 'done' | 'error'
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming: boolean
  createdAt: string // ISO 8601
  error?: string
  agentName?: string
  toolCalls?: ToolCall[]
}

