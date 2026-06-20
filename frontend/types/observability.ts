export interface ObservabilityEvent {
  timestamp: string
  event_type: string
  task_id: string
  agent: string | null
  duration_ms?: number
  [key: string]: unknown
}

export interface EventsResponse {
  events: ObservabilityEvent[]
  total: number
}

export interface TaskListResponse {
  task_ids: string[]
}
