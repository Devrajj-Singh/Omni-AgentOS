'use client'

import { Check, Moon } from 'lucide-react'

export function ThemePicker(): JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border-default bg-bg-base p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-bg-raised">
          <Moon className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Dark</p>
          <p className="text-xs text-text-muted">Default theme</p>
        </div>
      </div>
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
        <Check className="h-3 w-3 text-white" />
      </div>
    </div>
  )
}
