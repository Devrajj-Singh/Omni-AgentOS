export type ActivityStatus = 'running' | 'done' | 'error'

export interface ActivityEvent {
  id: string
  label: string
  message: string
  status: ActivityStatus
  timestamp: string
}
