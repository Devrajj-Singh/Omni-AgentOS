import { create } from 'zustand'
import type { WSEvent } from '@/types'

const MAX_LOGS = 500

interface LogEntry {
  id: string         // crypto.randomUUID()
  timestamp: string  // ISO from event.timestamp
  type: string       // event.type e.g. 'tool.call', 'token', 'error'
  taskId: string
  agentId: string | null
  summary: string    // human-readable one-liner derived from event
}

interface LogsState {
  entries: LogEntry[]
}

interface LogsActions {
  pushEvent: (event: WSEvent) => void
  clear: () => void
}

export type LogsStore = LogsState & LogsActions

function summarize(event: WSEvent): string {
  const p = event.payload as Record<string, unknown>
  switch (event.type) {
    case 'token':        return `token: "${String(p.text ?? '').slice(0, 60)}"`
    case 'tool.call':    return `tool call: ${p.tool}(${JSON.stringify(p.args ?? {}).slice(0, 80)})`
    case 'tool.result':  return `tool result: ${p.tool} → ${String(p.result ?? '').slice(0, 80)}`
    case 'agent.handoff':return `handoff: ${p.fromAgent ?? '?'} → ${p.toAgent}`
    case 'agent.thinking':return `thinking: ${String(p.reasoning ?? '').slice(0, 80)}`
    case 'error':        return `error: ${p.message}`
    case 'task.start':   return `task started (msg: ${p.messageId})`
    case 'task.complete':return `task complete`
    case 'approval.required': return `approval required: ${p.tool} [${p.riskLevel}]`
    case 'approval.resolved': return `approval ${p.decision}: ${p.approvalId}`
    case 'agent.task_graph_init':   return `task graph initialized (${(p.steps as unknown[])?.length ?? 0} steps)`
    case 'agent.task_graph_update': return `step ${p.stepId} → ${p.status}`
    default:             return event.type
  }
}

export const useLogsStore = create<LogsStore>()((set) => ({
  entries: [],
  pushEvent: (event) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: event.timestamp,
      type: event.type,
      taskId: event.taskId,
      agentId: event.agentId ?? null,
      summary: summarize(event),
    }
    set((state) => ({
      entries: [...state.entries.slice(-(MAX_LOGS - 1)), entry],
    }))
  },
  clear: () => set({ entries: [] }),
}))

export type { LogEntry }
