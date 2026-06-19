'use client'

import { motion } from 'framer-motion'
import { agentStyle } from '@/lib/agent-styles'
import type { ActivityEvent } from '@/types'

export interface ActivityEventItemProps {
  event: ActivityEvent
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function labelClassName(label: string): string {
  const agentName = label.match(/^\[(Planner|Researcher|Coder|Reviewer)\]$/)?.[1]
  if (!agentName) return 'text-accent'
  return agentStyle(agentName.toLowerCase()).color
}

export function ActivityEventItem({ event }: ActivityEventItemProps): JSX.Element {
  return (
    <motion.div
      initial={{ x: 12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-bg-raised"
    >
      <div className="mt-1.5 shrink-0">
        {event.status === 'running' && <div className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />}
        {event.status === 'done' && <div className="h-1.5 w-1.5 rounded-full bg-status-green" />}
        {event.status === 'error' && <div className="h-1.5 w-1.5 rounded-full bg-status-red" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-[11px] font-semibold ${labelClassName(event.label)}`}>{event.label}</span>
          <span className="text-[10px] text-text-muted">{formatTimestamp(event.timestamp)}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-text-muted">{event.message}</p>
      </div>
    </motion.div>
  )
}

export default ActivityEventItem
