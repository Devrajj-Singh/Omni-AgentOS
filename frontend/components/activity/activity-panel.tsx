'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useActivityStore } from '@/store/activity-store'
import { useUIStore } from '@/store/ui-store'
import { ActivityEventItem } from './activity-event-item'

const activityVariants = {
  open: { width: 280, opacity: 1, transition: { duration: 0.2 } },
  closed: { width: 0, opacity: 0, transition: { duration: 0.2 } },
}

export function ActivityPanel(): JSX.Element {
  const events = useActivityStore((state) => state.events)
  const { activityPanelOpen, wsConnected } = useUIStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  return (
    <motion.div
      variants={activityVariants}
      animate={activityPanelOpen ? 'open' : 'closed'}
      className="flex h-full flex-col bg-bg-surface"
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-default px-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Activity</span>
        <div className="flex items-center gap-1.5">
          <div className={wsConnected ? 'dot-live' : 'dot-offline'} />
          <span className="text-[10px] text-text-muted">{wsConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="p-4 text-sm text-text-muted">No activity yet.</div>
        ) : (
          events.map((event) => <ActivityEventItem key={event.id} event={event} />)
        )}
        <div ref={bottomRef} className="h-1" />
      </div>
    </motion.div>
  )
}

export default ActivityPanel
