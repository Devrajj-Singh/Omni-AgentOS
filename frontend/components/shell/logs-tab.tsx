'use client'

import { useEffect, useRef } from 'react'
import { useLogsStore } from '@/store/logs-store'
import type { LogEntry } from '@/store/logs-store'

const TYPE_COLORS: Record<string, string> = {
  'token':               'text-text-muted',
  'tool.call':           'text-blue-400',
  'tool.result':         'text-green-400',
  'agent.handoff':       'text-purple-400',
  'agent.thinking':      'text-yellow-400',
  'error':               'text-red-400',
  'task.start':          'text-cyan-400',
  'task.complete':       'text-cyan-400',
  'approval.required':   'text-orange-400',
  'approval.resolved':   'text-orange-300',
  'agent.task_graph_init':   'text-indigo-400',
  'agent.task_graph_update': 'text-indigo-300',
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour12: false })
  } catch {
    return '--:--:--'
  }
}

function LogLine({ entry }: { entry: LogEntry }) {
  const color = TYPE_COLORS[entry.type] ?? 'text-text-muted'
  const agent = entry.agentId ? `[${entry.agentId}] ` : ''
  return (
    <div className="flex gap-2 font-mono text-xs leading-5">
      <span className="shrink-0 text-text-disabled">{formatTime(entry.timestamp)}</span>
      <span className={`shrink-0 w-36 truncate ${color}`}>{entry.type}</span>
      <span className="text-text-muted">{agent}{entry.summary}</span>
    </div>
  )
}

export function LogsTab(): JSX.Element {
  const entries = useLogsStore((s) => s.entries)
  const clear = useLogsStore((s) => s.clear)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border-default px-3 py-1">
        <span className="text-xs text-text-muted">{entries.length} events</span>
        <button
          onClick={clear}
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-0.5">
        {entries.length === 0 ? (
          <div className="text-xs text-text-disabled">Waiting for events…</div>
        ) : (
          entries.map((entry) => <LogLine key={entry.id} entry={entry} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
