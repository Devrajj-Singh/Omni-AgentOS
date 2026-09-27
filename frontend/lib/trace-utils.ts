import type { ObsEvent } from '@/services/observability-api'

export interface Span {
  id: string           // e.g. "planner_node"
  label: string        // human-readable
  agent: string | null
  startMs: number      // ms since epoch
  endMs: number
  durationMs: number
  color: string
}

const AGENT_COLORS: Record<string, string> = {
  planner:    '#818cf8', // indigo
  coder:      '#34d399', // green
  researcher: '#60a5fa', // blue
  reviewer:   '#f472b6', // pink
  reflection: '#fb923c', // orange
}

function colorFor(agent: string | null): string {
  if (!agent) return '#94a3b8'
  const key = agent.toLowerCase().replace(/_agent$/, '')
  return AGENT_COLORS[key] ?? '#94a3b8'
}

export function buildSpans(events: ObsEvent[]): Span[] {
  // Pair _start / _end events by event_type prefix
  const startMap = new Map<string, ObsEvent>()
  const spans: Span[] = []

  for (const ev of events) {
    if (ev.event_type.endsWith('_start')) {
      const key = ev.event_type.replace(/_start$/, '')
      startMap.set(key, ev)
    } else if (ev.event_type.endsWith('_end')) {
      const key = ev.event_type.replace(/_end$/, '')
      const start = startMap.get(key)
      if (!start) continue
      const startMs = new Date(start.timestamp).getTime()
      const endMs = new Date(ev.timestamp).getTime()
      spans.push({
        id: `${key}-${startMs}`,
        label: key.replace(/_/g, ' '),
        agent: ev.agent ?? start.agent,
        startMs,
        endMs,
        durationMs: ev.duration_ms ?? (endMs - startMs),
        color: colorFor(ev.agent ?? start.agent),
      })
      startMap.delete(key)
    }
  }

  return spans.sort((a, b) => a.startMs - b.startMs)
}
