'use client'

import { useEffect, useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { getTaskEvents, listObservabilityTasks } from '@/services/api'
import type { ObservabilityEvent } from '@/types'
import { EventTimeline } from './event-timeline'
import { TaskList } from './task-list'

export function ObservabilityWorkspace(): JSX.Element {
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [events, setEvents] = useState<ObservabilityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadTasks = (): void => {
    setIsRefreshing(true)
    listObservabilityTasks()
      .then((res) => {
        setTaskIds(res.task_ids)
        setSelectedTaskId((current) => current ?? res.task_ids[0] ?? null)
      })
      .catch(console.error)
      .finally(() => {
        setIsLoading(false)
        setIsRefreshing(false)
      })
  }

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => {
    if (!selectedTaskId) {
      setEvents([])
      return
    }
    getTaskEvents(selectedTaskId)
      .then((res) => setEvents(res.events))
      .catch(console.error)
  }, [selectedTaskId])

  return (
    <div className="flex h-full flex-col bg-bg-base">
      <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-default px-4 py-2 sm:h-14 sm:px-6 sm:py-0">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" />
          <h1 className="text-sm font-semibold text-text-primary">Observability</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border-default bg-bg-surface px-2.5 py-0.5 text-xs text-text-muted">
            {taskIds.length} tasks
          </span>
          <button
            type="button"
            onClick={loadTasks}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-raised hover:text-text-primary"
            aria-label="Refresh observability tasks"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-border-default bg-bg-surface">
          <TaskList
            taskIds={taskIds}
            selectedTaskId={selectedTaskId}
            onSelect={setSelectedTaskId}
            isLoading={isLoading}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
          {selectedTaskId ? (
            <EventTimeline events={events} taskId={selectedTaskId} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
              No tasks yet. Send a message in Workspace or Research to see events here.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
