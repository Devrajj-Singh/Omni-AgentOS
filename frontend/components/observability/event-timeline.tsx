'use client'

import { agentStyle } from '@/lib/agent-styles'
import type { ObservabilityEvent } from '@/types'

interface EventTimelineProps {
  events: ObservabilityEvent[]
  taskId: string
}

function eventTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function EventTimeline({ events, taskId }: EventTimelineProps): JSX.Element {
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  return (
    <div>
      <p className="mb-4 font-mono text-xs text-text-muted">Task: {taskId}</p>
      <div className="space-y-1 border-l border-border-default pl-4">
        {sorted.map((event, idx) => {
          const style = event.agent ? agentStyle(event.agent) : null
          return (
            <div key={`${event.timestamp}-${event.event_type}-${idx}`} className="relative pb-3">
              <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-border-strong" />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-text-secondary">{event.event_type}</span>
                {style && <span className={style.color}>[{style.label}]</span>}
                {typeof event.duration_ms === 'number' && (
                  <span className="text-text-muted">{event.duration_ms}ms</span>
                )}
                {'tool' in event && typeof event.tool === 'string' && (
                  <span className="rounded border border-border-default px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                    {event.tool}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-text-muted">{eventTime(event.timestamp)}</p>
            </div>
          )
        })}
        {sorted.length === 0 && (
          <p className="text-sm text-text-muted">No events recorded for this task.</p>
        )}
      </div>
    </div>
  )
}
