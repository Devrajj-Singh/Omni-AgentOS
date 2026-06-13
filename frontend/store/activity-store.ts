import { create } from 'zustand'
import type { ActivityEvent } from '@/types'

const MAX_EVENTS = 500

interface ActivityState {
  events: ActivityEvent[]
}

interface ActivityActions {
  addEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void
  clearEvents: () => void
}

type ActivityStore = ActivityState & ActivityActions

export const useActivityStore = create<ActivityStore>()((set) => ({
  events: [],

  addEvent: (event) =>
    set((state) => {
      const newEvents: ActivityEvent[] = [
        ...state.events,
        {
          ...event,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      ]
      return {
        events: newEvents.length > MAX_EVENTS ? newEvents.slice(-MAX_EVENTS) : newEvents,
      }
    }),

  clearEvents: () => set({ events: [] }),
}))

export default useActivityStore
