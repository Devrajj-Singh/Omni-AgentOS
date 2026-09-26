'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Loader2,
  PauseCircle,
  XCircle,
  MinusCircle,
  Code2,
  Search,
  CheckCheck,
  Terminal,
  FileCode,
  Layers,
  Sparkles,
} from 'lucide-react'
import type { TaskGraph, TaskGraphStep, TaskGraphStepStatus } from '@/types'

interface TaskGraphViewProps {
  taskGraph: TaskGraph
  compact?: boolean
  className?: string
}

function getStatusIcon(status: TaskGraphStepStatus): JSX.Element {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
    case 'running':
      return <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
    case 'awaiting_approval':
      return <PauseCircle className="h-4 w-4 text-amber-500 animate-pulse shrink-0" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
    case 'skipped':
      return <MinusCircle className="h-4 w-4 text-text-disabled shrink-0" />
    case 'pending':
    default:
      return <Circle className="h-4 w-4 text-text-disabled/60 shrink-0" />
  }
}

function getAgentBadge(agent: string): { label: string; className: string; icon: JSX.Element } {
  switch (agent.toLowerCase()) {
    case 'researcher':
      return {
        label: 'Researcher',
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: <Search className="h-3 w-3" />,
      }
    case 'reviewer':
      return {
        label: 'Reviewer',
        className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        icon: <CheckCheck className="h-3 w-3" />,
      }
    case 'coder':
    default:
      return {
        label: 'Coder',
        className: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        icon: <Code2 className="h-3 w-3" />,
      }
  }
}

function getActionIcon(action: string): JSX.Element {
  switch (action.toLowerCase()) {
    case 'run_command':
      return <Terminal className="h-3 w-3 text-text-muted" />
    case 'write_file':
      return <FileCode className="h-3 w-3 text-text-muted" />
    case 'research':
      return <Search className="h-3 w-3 text-text-muted" />
    default:
      return <Layers className="h-3 w-3 text-text-muted" />
  }
}

export function TaskGraphView({ taskGraph, compact = false, className = '' }: TaskGraphViewProps): JSX.Element {
  const completedCount = taskGraph.steps.filter((s) => s.status === 'done').length
  const totalCount = taskGraph.steps.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div
      className={`rounded-xl border border-border-default bg-bg-surface/90 shadow-lg backdrop-blur-md overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default/60 px-3.5 py-2.5 bg-bg-base/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/10 text-accent shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-text-primary truncate">
              {taskGraph.project_name || 'Autonomous Task Plan'}
            </h4>
            <p className="text-[10px] text-text-muted">
              {completedCount} of {totalCount} steps completed ({progressPercent}%)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          <div className="h-1.5 w-16 bg-bg-base rounded-full overflow-hidden border border-border-default/40">
            <div
              className="h-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="divide-y divide-border-default/30 p-1.5 space-y-1">
        <AnimatePresence initial={false}>
          {taskGraph.steps.map((step, idx) => {
            const agent = getAgentBadge(step.agent)
            const isRunning = step.status === 'running'
            const isAwaitingApproval = step.status === 'awaiting_approval'

            return (
              <motion.div
                key={step.id || idx}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`rounded-lg p-2 transition-all ${
                  isRunning
                    ? 'bg-amber-500/10 border border-amber-500/30 shadow-sm'
                    : isAwaitingApproval
                    ? 'bg-amber-500/15 border border-amber-500/40 shadow-sm'
                    : step.status === 'done'
                    ? 'bg-emerald-500/5 border border-emerald-500/10'
                    : 'bg-transparent border border-transparent hover:bg-bg-base/30'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">{getStatusIcon(step.status)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5 mb-1 flex-wrap">
                      <span
                        className={`text-xs font-medium leading-tight ${
                          step.status === 'done'
                            ? 'text-text-muted line-through decoration-text-disabled/60'
                            : isRunning
                            ? 'text-amber-300'
                            : isAwaitingApproval
                            ? 'text-amber-400'
                            : 'text-text-primary'
                        }`}
                      >
                        {step.title}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${agent.className}`}
                        >
                          {agent.icon}
                          {agent.label}
                        </span>
                        {step.action && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono text-text-muted bg-bg-base/60 border border-border-default/40"
                            title={step.action}
                          >
                            {getActionIcon(step.action)}
                            {step.action}
                          </span>
                        )}
                      </div>
                    </div>

                    {!compact && step.description && (
                      <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                        {step.description}
                      </p>
                    )}

                    {isAwaitingApproval && (
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                        <PauseCircle className="h-3 w-3" />
                        Human approval required to proceed
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default TaskGraphView
