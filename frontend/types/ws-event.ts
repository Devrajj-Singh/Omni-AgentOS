export type WSEventType =
  | 'token'
  | 'agent.thinking'
  | 'agent.done'
  | 'agent.handoff'
  | 'tool.call'
  | 'tool.result'
  | 'approval.required'
  | 'approval.resolved'
  | 'task.start'
  | 'task.complete'
  | 'error'

export interface WSEvent {
  type: WSEventType
  taskId: string
  agentId?: string
  payload: unknown
  timestamp: string // ISO 8601
}
