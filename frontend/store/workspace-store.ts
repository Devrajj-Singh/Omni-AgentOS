import { create } from 'zustand'
import type { Workspace } from '@/types'

interface WorkspaceState {
  activeWorkspace: Workspace | null
  openTabs: string[]          // tab identifiers (e.g. 'chat', 'editor:file.ts')
  activeTabId: string | null
  activeTaskId: string | null
}

interface WorkspaceActions {
  setActiveWorkspace: (workspace: Workspace) => void
  openTab: (tabId: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setActiveTaskId: (taskId: string | null) => void
}

type WorkspaceStore = WorkspaceState & WorkspaceActions

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  // Initial state
  activeWorkspace: null,
  openTabs: ['chat'],
  activeTabId: 'chat',
  activeTaskId: null,

  // Actions
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),

  openTab: (tabId) =>
    set((state) => ({
      openTabs: state.openTabs.includes(tabId)
        ? state.openTabs
        : [...state.openTabs, tabId],
      activeTabId: tabId,
    })),

  closeTab: (tabId) =>
    set((state) => {
      const newOpenTabs = state.openTabs.filter((id) => id !== tabId)
      const newActiveTabId =
        state.activeTabId === tabId
          ? newOpenTabs[newOpenTabs.length - 1] ?? null
          : state.activeTabId

      return {
        openTabs: newOpenTabs,
        activeTabId: newActiveTabId,
      }
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setActiveTaskId: (taskId) => set({ activeTaskId: taskId }),
}))

export default useWorkspaceStore
