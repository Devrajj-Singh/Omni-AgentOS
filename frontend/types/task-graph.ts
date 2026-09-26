export type TaskGraphStepStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'done'
  | 'skipped'
  | 'failed'

export interface TaskGraphStep {
  id: string
  title: string
  agent: 'coder' | 'researcher' | 'reviewer' | string
  action: 'write_file' | 'run_command' | 'research' | 'review' | string
  approval_required: boolean
  description: string
  status: TaskGraphStepStatus
}

export interface TaskGraph {
  project_name: string
  steps: TaskGraphStep[]
}
