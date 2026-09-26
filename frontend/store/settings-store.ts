import { create } from 'zustand'
import type { AppSettings, ModelInfo } from '@/types'

const STORAGE_KEY = 'omni_user_api_key'

function getInitialUserApiKey(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

interface SettingsState {
  activeModel: string
  availableModels: ModelInfo[]
  memoryCount: number
  hasUserApiKey: boolean
  userApiKey: string | null
  isLoading: boolean
  error: string | null
  setSettings(settings: Partial<AppSettings>): void
  setActiveModel(modelId: string): void
  setMemoryCount(count: number): void
  setUserApiKey(key: string): void
  clearUserApiKey(): void
  setLoading(value: boolean): void
  setError(error: string | null): void
}

export const useSettingsStore = create<SettingsState>()((set) => {
  const initialKey = getInitialUserApiKey()
  return {
    activeModel: 'openai/gpt-oss-120b',
    availableModels: [],
    memoryCount: 0,
    hasUserApiKey: Boolean(initialKey),
    userApiKey: initialKey,
    isLoading: false,
    error: null,

    setSettings: (settings) =>
      set((state) => ({
        ...state,
        ...settings,
        hasUserApiKey:
          settings.hasUserApiKey !== undefined
            ? settings.hasUserApiKey
            : state.hasUserApiKey || Boolean(state.userApiKey),
      })),
    setActiveModel: (modelId) => set({ activeModel: modelId }),
    setMemoryCount: (count) => set({ memoryCount: count }),
    setUserApiKey: (key: string) => {
      const trimmed = key.trim()
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(STORAGE_KEY, trimmed)
        } catch {
          // ignore sessionStorage write errors
        }
      }
      set({ userApiKey: trimmed, hasUserApiKey: Boolean(trimmed) })
    },
    clearUserApiKey: () => {
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(STORAGE_KEY)
        } catch {
          // ignore
        }
      }
      set({ userApiKey: null, hasUserApiKey: false })
    },
    setLoading: (value) => set({ isLoading: value }),
    setError: (error) => set({ error }),
  }
})

export default useSettingsStore
