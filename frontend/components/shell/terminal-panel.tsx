'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import { useResize } from '@/hooks/use-resize'
import { ResizeHandle } from './resize-handle'

type TabType = 'logs' | 'terminal' | 'traces'

const terminalVariants = {
  open: (height: number) => ({ height, transition: { duration: 0.2 } }),
  closed: { height: 40, transition: { duration: 0.2 } },
}

export function TerminalPanel(): JSX.Element {
  const { terminalPanelOpen, terminalPanelHeight, toggleTerminalPanel } = useUIStore()
  const [activeTab, setActiveTab] = useState<TabType>('logs')
  const contentRef = useRef<HTMLDivElement>(null)
  const { handleMouseDown } = useResize()

  useEffect(() => {
    if (contentRef.current && terminalPanelOpen) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [terminalPanelOpen])

  return (
    <motion.div
      variants={terminalVariants}
      animate={terminalPanelOpen ? 'open' : 'closed'}
      custom={terminalPanelHeight}
      className="flex h-full flex-col overflow-hidden bg-bg-surface"
    >
      {terminalPanelOpen && <ResizeHandle onMouseDown={handleMouseDown} />}

      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border-default px-2">
        {(['logs', 'terminal', 'traces'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3 py-1 text-xs capitalize transition-colors ${
              activeTab === tab ? 'bg-bg-raised text-text-primary' : 'text-text-muted hover:text-text-secondary'
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

      {terminalPanelOpen && (
        <div ref={contentRef} className="flex-1 overflow-auto bg-bg-base p-4 font-mono text-xs text-text-muted">
          {activeTab === 'logs' && (
            <div className="space-y-1">
              <div>[12:00:00] System initialized</div>
              <div>[12:00:01] Workspace loaded</div>
              <div>[12:00:02] Ready</div>
            </div>
          )}
          {activeTab === 'terminal' && <div className="text-accent">$ </div>}
          {activeTab === 'traces' && <div>No traces available</div>}
        </div>
      )}
    </motion.div>
  )
}

export default TerminalPanel
