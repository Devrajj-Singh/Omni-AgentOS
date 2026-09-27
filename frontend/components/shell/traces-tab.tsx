'use client'

import { useCallback, useEffect, useState } from 'react'
import { useChatStore } from '@/store/chat-store'
import { fetchTaskEvents, fetchTaskIds } from '@/services/observability-api'
import { buildSpans, type Span } from '@/lib/trace-utils'

function GanttBar({ span, minMs, totalMs }: { span: Span; minMs: number; totalMs: number }) {
  const left = totalMs > 0 ? ((span.startMs - minMs) / totalMs) * 100 : 0
  const width = totalMs > 0 ? (span.durationMs / totalMs) * 100 : 1

  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-36 shrink-0 truncate text-right text-xs text-text-muted capitalize">
        {span.label}
      </div>
      <div className="relative flex-1 h-5">
        <div className="absolute inset-y-0 rounded" style={{
          left: `${left}%`,
          width: `${Math.max(width, 0.5)}%`,
          backgroundColor: span.color,
          opacity: 0.85,
        }} />
      </div>
      <div className="w-16 shrink-0 text-xs text-text-muted text-right">
        {span.durationMs < 1000
          ? `${Math.round(span.durationMs)}ms`
          : `${(span.durationMs / 1000).toFixed(1)}s`}
      </div>
    </div>
  )
}

export function TracesTab(): JSX.Element {
  const currentTaskId = useChatStore((s) => s.currentTaskId)
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [spans, setSpans] = useState<Span[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load task list
  useEffect(() => {
    fetchTaskIds()
      .then((ids) => {
        setTaskIds(ids)
        // Auto-select: prefer the current streaming task, else the most recent
        setSelectedTaskId((prev) => prev ?? currentTaskId ?? ids[0] ?? null)
      })
      .catch(() => {})
  }, [currentTaskId])

  // Load spans for selected task
  const loadSpans = useCallback(async (taskId: string) => {
    setLoading(true)
    setError(null)
    try {
      const events = await fetchTaskEvents(taskId)
      setSpans(buildSpans(events))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedTaskId) loadSpans(selectedTaskId)
  }, [selectedTaskId, loadSpans])

  const minMs = spans.length > 0 ? Math.min(...spans.map((s) => s.startMs)) : 0
  const maxMs = spans.length > 0 ? Math.max(...spans.map((s) => s.endMs)) : 0
  const totalMs = maxMs - minMs || 1

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-default px-3 py-1">
        <span className="text-xs text-text-muted">Task:</span>
        <select
          value={selectedTaskId ?? ''}
          onChange={(e) => setSelectedTaskId(e.target.value || null)}
          className="flex-1 bg-bg-raised text-xs text-text-primary border border-border-default rounded px-1 py-0.5 outline-none"
        >
          <option value="">— select task —</option>
          {taskIds.map((id) => (
            <option key={id} value={id}>{id.slice(0, 20)}…</option>
          ))}
        </select>
        <button
          onClick={() => selectedTaskId && loadSpans(selectedTaskId)}
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {loading && <div className="text-xs text-text-muted">Loading…</div>}
        {error && <div className="text-xs text-red-400">{error}</div>}
        {!loading && !error && spans.length === 0 && (
          <div className="text-xs text-text-disabled">No spans recorded for this task.</div>
        )}
        {spans.map((span) => (
          <GanttBar key={span.id} span={span} minMs={minMs} totalMs={totalMs} />
        ))}
      </div>

      {spans.length > 0 && (
        <div className="shrink-0 border-t border-border-default px-3 py-1 text-xs text-text-muted">
          {spans.length} spans · total {((totalMs) / 1000).toFixed(2)}s
        </div>
      )}
    </div>
  )
}
