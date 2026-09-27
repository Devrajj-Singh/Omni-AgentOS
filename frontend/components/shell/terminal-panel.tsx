'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import { useResize } from '@/hooks/use-resize'
import { ResizeHandle } from './resize-handle'
import { LogsTab } from './logs-tab'
import { TracesTab } from './traces-tab'
import { TerminalTab } from './terminal-tab'

type TabType = 'logs' | 'traces' | 'terminal'

export function TerminalPanel(): JSX.Element {
  const { terminalPanelOpen, toggleTerminalPanel } = useUIStore()
  const [activeTab, setActiveTab] = useState<TabType>('logs')
  const { handleMouseDown } = useResize()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-surface">
      {terminalPanelOpen && <ResizeHandle onMouseDown={handleMouseDown} />}

      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border-default px-2">
        {(['logs', 'traces', 'terminal'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3 py-1 text-xs capitalize transition-colors ${
              activeTab === tab ? 'bg-bg-raised text-text-primary font-medium' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={toggleTerminalPanel}
          className="p-1 text-text-muted transition-colors hover:text-text-primary"
          aria-label={terminalPanelOpen ? 'Collapse terminal' : 'Expand terminal'}
        >
          {terminalPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      <div className={`flex-1 min-h-0 overflow-hidden ${terminalPanelOpen ? '' : 'hidden'}`}>
        <div className={activeTab === 'logs' ? 'h-full flex flex-col overflow-hidden' : 'hidden'}>
          <LogsTab />
        </div>
        <div className={activeTab === 'traces' ? 'h-full flex flex-col overflow-hidden' : 'hidden'}>
          <TracesTab />
        </div>
        <div className={activeTab === 'terminal' ? 'h-full flex flex-col overflow-hidden' : 'hidden'}>
          <TerminalTab />
        </div>
      </div>
    </div>
  )
}

export default TerminalPanel
