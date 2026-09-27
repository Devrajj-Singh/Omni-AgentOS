const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export interface ObsEvent {
  timestamp: string
  event_type: string
  task_id: string
  agent: string | null
  duration_ms?: number
  [key: string]: unknown
}

export interface ObsEventsResponse {
  events: ObsEvent[]
  total: number
}

export async function fetchTaskEvents(taskId: string): Promise<ObsEvent[]> {
  const res = await fetch(`${BASE}/api/v1/observability/tasks/${encodeURIComponent(taskId)}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: ObsEventsResponse = await res.json()
  return data.events
}

export async function fetchTaskIds(): Promise<string[]> {
  const res = await fetch(`${BASE}/api/v1/observability/tasks`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: { task_ids: string[] } = await res.json()
  return data.task_ids
}
