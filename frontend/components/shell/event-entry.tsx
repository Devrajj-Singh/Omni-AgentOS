'use client'

import { motion } from 'framer-motion'
import { Zap, Brain, CheckCircle, Wrench, PackageCheck, Play, Flag, AlertCircle, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { WSEvent, WSEventType } from '@/types'

export interface EventEntryProps {
  event: WSEvent
}

const eventIconMap: Record<WSEventType, LucideIcon> = {
  token: Zap,
  'agent.thinking': Brain,
  'agent.done': CheckCircle,
  'tool.call': Wrench,
  'tool.result': PackageCheck,
  'approval.required': ShieldCheck,
  'approval.resolved': CheckCircle,
  'task.start': Play,
  'task.complete': Flag,
  error: AlertCircle,
}

const eventLabelMap: Record<WSEventType, string> = {
  token: 'Token',
  'agent.thinking': 'Thinking',
  'agent.done': 'Done',
  'tool.call': 'Tool Call',
  'tool.result': 'Tool Result',
  'approval.required': 'Approval Required',
  'approval.resolved': 'Approval Resolved',
  'task.start': 'Task Start',
  'task.complete': 'Task Complete',
  error: 'Error',
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function EventEntry({ event }: EventEntryProps): JSX.Element {
  const Icon = eventIconMap[event.type]
  const label = eventLabelMap[event.type]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-3 p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
    >
      <Icon className="w-4 h-4 text-accent-blue flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-primary">{label}</span>
          <span className="text-xs text-text-muted font-mono">{formatTimestamp(event.timestamp)}</span>
        </div>
        {event.agentId && (
          <div className="text-xs text-accent-purple mt-0.5">[{event.agentId}]</div>
        )}
      </div>
    </motion.div>
  )
}

export default EventEntry
