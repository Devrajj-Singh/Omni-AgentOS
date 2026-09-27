import { describe, it, expect } from 'vitest'
import { buildSpans } from './trace-utils'
import type { ObsEvent } from '@/services/observability-api'

describe('trace-utils buildSpans', () => {
  it('pairs _start and _end events into spans', () => {
    const events: ObsEvent[] = [
      {
        timestamp: '2026-09-27T10:00:00.000Z',
        event_type: 'planner_node_start',
        task_id: 'task-1',
        agent: 'planner',
      },
      {
        timestamp: '2026-09-27T10:00:02.500Z',
        event_type: 'planner_node_end',
        task_id: 'task-1',
        agent: 'planner',
        duration_ms: 2500,
      },
    ]

    const spans = buildSpans(events)
    expect(spans).toHaveLength(1)
    expect(spans[0].label).toBe('planner node')
    expect(spans[0].durationMs).toBe(2500)
    expect(spans[0].color).toBe('#818cf8')
  })

  it('handles empty events gracefully', () => {
    expect(buildSpans([])).toEqual([])
  })
})
