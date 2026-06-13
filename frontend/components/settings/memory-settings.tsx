'use client'

import { Brain, Download, Trash2 } from 'lucide-react'
import { clearAllMemories, exportMemories } from '@/services/api'

interface MemorySettingsProps {
  memoryCount: number
  onCountChange: (count: number) => void
}

export function MemorySettings({ memoryCount, onCountChange }: MemorySettingsProps): JSX.Element {
  const handleExport = async (): Promise<void> => {
    const data = await exportMemories()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)

    link.href = url
    link.download = `omni-memories-${date}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleClearAll = async (): Promise<void> => {
    const confirmed = window.confirm(`Delete all ${memoryCount} memories? This cannot be undone.`)
    if (!confirmed) return

    await clearAllMemories()
    onCountChange(0)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-lg border border-border-default bg-bg-base px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <span className="text-sm text-text-secondary">Stored memories</span>
        </div>
        <span className="text-sm font-semibold text-text-primary">{memoryCount}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => void handleExport()} className="btn-ghost flex flex-1 items-center justify-center gap-2 py-2.5">
          <Download className="h-4 w-4" />
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => void handleClearAll()}
          disabled={memoryCount === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-status-red/25 bg-status-red/10 py-2.5 text-sm text-status-red transition-colors hover:bg-status-red/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          Clear All
        </button>
      </div>
    </div>
  )
}
