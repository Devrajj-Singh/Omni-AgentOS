'use client'

import { Zap } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'

export function AutonomousToggle(): JSX.Element {
  const autonomousMode = useUIStore((state) => state.autonomousMode)
  const toggleAutonomousMode = useUIStore((state) => state.toggleAutonomousMode)

  return (
    <button
      type="button"
      onClick={toggleAutonomousMode}
      title={autonomousMode ? 'Autonomous mode on - click to require approvals' : 'Manual mode - click to skip approvals'}
      className={`flex items-center gap-1.5 rounded-btn border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        autonomousMode
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-border-default bg-bg-surface text-text-muted hover:text-text-secondary'
      }`}
    >
      <Zap className={`h-3 w-3 ${autonomousMode ? 'fill-accent' : ''}`} />
      {autonomousMode ? 'Auto' : 'Manual'}
    </button>
  )
}
