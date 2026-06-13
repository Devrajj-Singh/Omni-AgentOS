'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import { Sidebar } from './sidebar'
import { ActivityPanel } from '@/components/activity/activity-panel'
import { TerminalPanel } from './terminal-panel'

export function AppShell({ children }: { children: React.ReactNode }): JSX.Element {
  const { activityPanelOpen, terminalPanelOpen, terminalPanelHeight, toggleActivityPanel } = useUIStore()
  const [isCompact, setIsCompact] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const updateLayout = (): void => {
      const width = window.innerWidth
      setIsCompact(width < 1180)
      setIsMobile(width < 640)
    }

    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [])

  const showActivityPanel = activityPanelOpen && !isCompact && !isMobile
  const terminalRow = terminalPanelOpen ? `${terminalPanelHeight}px` : '40px'

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg-base">
      <div className="fixed right-0 top-1/2 z-50 hidden -translate-y-1/2 lg:block">
        <button
          onClick={toggleActivityPanel}
          className="flex h-16 w-5 items-center justify-center rounded-l-md border border-r-0 border-border-default bg-bg-surface text-text-muted transition-colors hover:bg-bg-raised hover:text-text-primary"
          title={activityPanelOpen ? 'Hide activity' : 'Show activity'}
          aria-label={activityPanelOpen ? 'Hide activity' : 'Show activity'}
        >
          <ChevronLeft className={`h-3 w-3 transition-transform duration-200 ${activityPanelOpen ? '' : 'rotate-180'}`} />
        </button>
      </div>

      <div
        className="relative grid h-full w-full"
        style={{
          gridTemplateColumns: isMobile
            ? 'minmax(0, 1fr)'
            : `auto minmax(0, 1fr) ${showActivityPanel ? '280px' : '0px'}`,
          gridTemplateRows: isMobile ? 'minmax(0, 1fr) 56px' : `minmax(0, 1fr) ${terminalRow}`,
          transition: 'grid-template-columns 0.2s ease, grid-template-rows 0.2s ease',
        }}
      >
        <div
          className={isMobile ? '' : 'border-r border-border-default'}
          style={{
            gridColumn: isMobile ? '1' : '1',
            gridRow: isMobile ? '2' : '1',
          }}
        >
          <Sidebar variant={isMobile ? 'bottom' : 'side'} />
        </div>
        <div
          className="min-w-0 overflow-hidden"
          style={{
            gridColumn: isMobile ? '1' : '2',
            gridRow: isMobile ? '1' : '1',
          }}
        >
          {children}
        </div>
        <div
          className="overflow-hidden border-l border-border-default"
          style={{
            gridColumn: isMobile ? '1' : '3',
            gridRow: '1',
            width: showActivityPanel ? '280px' : '0px',
            opacity: showActivityPanel ? 1 : 0,
            transition: 'width 0.2s ease, opacity 0.15s ease',
          }}
        >
          <ActivityPanel />
        </div>
        {!isMobile && (
          <div
            className="border-t border-border-default"
            style={{
              gridColumn: '1 / -1',
              gridRow: '2',
            }}
          >
            <TerminalPanel />
          </div>
        )}
      </div>
    </div>
  )
}

export default AppShell
