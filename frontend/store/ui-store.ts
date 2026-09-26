import { create } from 'zustand'

export interface Artifact {
  title: string
  content: string
  language: string
}

interface UIState {
  sidebarOpen: boolean
  activityPanelOpen: boolean
  terminalPanelOpen: boolean
  terminalPanelHeight: number
  explorerPanelWidth: number
  artifactsPanelOpen: boolean
  artifactsPanelWidth: number
  artifactsPanelFullScreen: boolean
  activeArtifact: Artifact | null
  wsConnected: boolean
  autonomousMode: boolean
}

interface UIActions {
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setActivityPanelOpen: (open: boolean) => void
  toggleActivityPanel: () => void
  setTerminalPanelOpen: (open: boolean) => void
  toggleTerminalPanel: () => void
  setTerminalPanelHeight: (height: number) => void
  setExplorerPanelWidth: (width: number) => void
  setArtifactsPanelOpen: (open: boolean) => void
  setArtifactsPanelWidth: (width: number) => void
  setArtifactsPanelFullScreen: (fullscreen: boolean) => void
  setActiveArtifact: (artifact: Artifact | null) => void
  setWsConnected: (connected: boolean) => void
  toggleAutonomousMode: () => void
  setAutonomousMode: (value: boolean) => void
}

type UIStore = UIState & UIActions

export const useUIStore = create<UIStore>()((set) => ({
  // Initial state
  sidebarOpen: true,
  activityPanelOpen: true,
  terminalPanelOpen: false,
  terminalPanelHeight: 160,
  explorerPanelWidth: 260,
  artifactsPanelOpen: false,
  artifactsPanelWidth: 400,
  artifactsPanelFullScreen: false,
  activeArtifact: null,
  wsConnected: false,
  autonomousMode: false,

  // Actions
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActivityPanelOpen: (open) => set({ activityPanelOpen: open }),
  toggleActivityPanel: () => set((state) => ({ activityPanelOpen: !state.activityPanelOpen })),
  setTerminalPanelOpen: (open) => set({ terminalPanelOpen: open }),
  toggleTerminalPanel: () => set((state) => ({ terminalPanelOpen: !state.terminalPanelOpen })),
  setTerminalPanelHeight: (height) => set({ terminalPanelHeight: height }),
  setExplorerPanelWidth: (width) => set({ explorerPanelWidth: width }),
  setArtifactsPanelOpen: (open) => set({ artifactsPanelOpen: open }),
  setArtifactsPanelWidth: (width) => set({ artifactsPanelWidth: width }),
  setArtifactsPanelFullScreen: (fullscreen) => set({ artifactsPanelFullScreen: fullscreen }),
  setActiveArtifact: (artifact) => set({ activeArtifact: artifact, artifactsPanelOpen: !!artifact }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  toggleAutonomousMode: () => set((state) => ({ autonomousMode: !state.autonomousMode })),
  setAutonomousMode: (value) => set({ autonomousMode: value }),
}))

export const useUiStore = useUIStore

export default useUIStore
