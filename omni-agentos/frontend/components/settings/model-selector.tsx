'use client'

import { useState } from 'react'
import type { ModelInfo } from '@/types'

interface ModelSelectorProps {
  models: ModelInfo[]
  activeModel: string
  onSelect: (id: string) => Promise<void>
}

export function ModelSelector({ models, activeModel, onSelect }: ModelSelectorProps): JSX.Element {
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleSelect = async (modelId: string): Promise<void> => {
    if (isSaving || modelId === activeModel) return

    setIsSaving(true)
    try {
      await onSelect(modelId)
      setShowConfirmation(true)
      window.setTimeout(() => setShowConfirmation(false), 2000)
    } catch {
      setShowConfirmation(false)
    } finally {
      setIsSaving(false)
    }
  }

  if (models.length === 0) {
    return <div className="rounded-lg border border-border-default bg-bg-base p-4 text-sm text-text-muted">No models available.</div>
  }

  return (
    <div className="relative">
      {showConfirmation && (
        <div className="absolute right-0 top-0 z-10 rounded-full border border-accent/30 bg-accent px-3 py-1 text-xs font-semibold text-white">
          Model updated
        </div>
      )}
      <div className="grid gap-3">
        {models.map((model) => {
          const isActive = model.id === activeModel
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => void handleSelect(model.id)}
              disabled={isSaving}
              className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-all duration-150 disabled:cursor-wait disabled:opacity-70 ${
                isActive
                  ? 'border-accent/40 bg-accent/10 text-text-primary'
                  : 'border-border-default bg-bg-base hover:border-border-strong hover:bg-bg-raised'
              }`}
            >
              <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${model.speed === 'instant' ? 'bg-status-green' : 'bg-accent'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{model.name}</span>
                  {isActive && (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-muted">{model.description}</p>
                <p className="mt-1 text-[10px] text-text-disabled">
                  {model.provider} | {model.speed}
                </p>
              </div>
              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${isActive ? 'border-accent bg-accent' : 'border-border-strong'}`}>
                {isActive && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
