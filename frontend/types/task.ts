export type TaskStatus = 'pending' | 'running' | 'complete' | 'failed'

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
}

export interface Task {
  id: string
  intent: string
  status: TaskStatus
  plan: string[]
  toolCalls: ToolCall[]
  result?: string
  createdAt: string
  updatedAt: string
}
