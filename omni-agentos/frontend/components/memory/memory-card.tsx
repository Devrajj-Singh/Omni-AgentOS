'use client'

import { motion } from 'framer-motion'
import { Folder, Trash2 } from 'lucide-react'
import type { MemoryItem } from '@/types'

interface MemoryCardProps {
  memory: MemoryItem
  index?: number
  onDelete: (id: string) => void
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function workspaceName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) ?? path
}

export function MemoryCard({ memory, index = 0, onDelete }: MemoryCardProps): JSX.Element {
  function handleDelete(): void {
    if (window.confirm('Delete this memory?')) {
      onDelete(memory.id)
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="card card-hover p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-xs text-text-muted">{formatTimestamp(memory.timestamp)}</span>
        {memory.relevance > 0 ? (
          <span className="inline-flex shrink-0 rounded-full border border-status-green/20 bg-status-green/10 px-2 py-0.5 text-[10px] font-medium text-status-green">
            {(memory.relevance * 100).toFixed(0)}% match
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 text-text-muted transition-colors hover:text-status-red"
          aria-label="Delete memory"
          title="Delete memory"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">You</span>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{memory.userMessage}</p>
        </div>
        <div className="border-l border-border-default pl-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Agent</span>
          <p className="mt-1 line-clamp-3 overflow-hidden text-xs leading-5 text-text-muted">{memory.assistantMessage}</p>
        </div>
      </div>

      {memory.workspacePath ? (
        <div className="mt-4 inline-flex max-w-full items-center gap-1 rounded-md border border-border-default bg-bg-base px-2 py-1 text-xs text-text-muted">
          <Folder className="h-3 w-3 shrink-0" />
          <span className="truncate">{workspaceName(memory.workspacePath)}</span>
        </div>
      ) : null}
    </motion.article>
  )
}

export default MemoryCard
