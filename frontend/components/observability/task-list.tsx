'use client'

interface TaskListProps {
  taskIds: string[]
  selectedTaskId: string | null
  onSelect: (id: string) => void
  isLoading: boolean
}

function shortTaskId(taskId: string): string {
  return `${taskId.slice(0, 8)}...`
}

export function TaskList({
  taskIds,
  selectedTaskId,
  onSelect,
  isLoading,
}: TaskListProps): JSX.Element {
  if (isLoading) {
    return <div className="p-4 text-sm text-text-muted">Loading tasks...</div>
  }

  if (taskIds.length === 0) {
    return <div className="p-4 text-sm text-text-muted">No tasks recorded yet.</div>
  }

  return (
    <div className="p-2">
      {taskIds.map((taskId) => {
        const isSelected = taskId === selectedTaskId
        return (
          <button
            key={taskId}
            type="button"
            onClick={() => onSelect(taskId)}
            className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
              isSelected
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary'
            }`}
            title={taskId}
          >
            <span className="font-mono text-xs">{shortTaskId(taskId)}</span>
          </button>
        )
      })}
    </div>
  )
}
