import { create } from 'zustand'
import type { AppSettings, ModelInfo } from '@/types'

interface SettingsState {
  activeModel: string
  availableModels: ModelInfo[]
  memoryCount: number
  isLoading: boolean
  error: string | null
  setSettings(settings: Partial<AppSettings>): void
  setActiveModel(modelId: string): void
  setMemoryCount(count: number): void
  setLoading(value: boolean): void
  setError(error: string | null): void
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  activeModel: 'llama-3.3-70b-versatile',
  availableModels: [],
  memoryCount: 0,
  isLoading: false,
  error: null,

  setSettings: (settings) => set((state) => ({ ...state, ...settings })),
  setActiveModel: (modelId) => set({ activeModel: modelId }),
  setMemoryCount: (count) => set({ memoryCount: count }),
  setLoading: (value) => set({ isLoading: value }),
  setError: (error) => set({ error }),
}))

export default useSettingsStore
