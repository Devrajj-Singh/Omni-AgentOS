import { create } from 'zustand'
import type { MemoryItem } from '@/types'

interface MemoryState {
  memories: MemoryItem[]
  searchResults: MemoryItem[]
  totalCount: number
  isLoading: boolean
  isSearching: boolean
  searchQuery: string
  error: string | null
  setMemories(memories: MemoryItem[], total: number): void
  setSearchResults(results: MemoryItem[]): void
  setSearchQuery(query: string): void
  removeMemory(id: string): void
  setLoading(value: boolean): void
  setSearching(value: boolean): void
  setError(error: string | null): void
  clearSearch(): void
}

export const useMemoryStore = create<MemoryState>()((set) => ({
  memories: [],
  searchResults: [],
  totalCount: 0,
  isLoading: false,
  isSearching: false,
  searchQuery: '',
  error: null,

  setMemories: (memories, total) => set({ memories, totalCount: total }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  removeMemory: (id) =>
    set((state) => ({
      memories: state.memories.filter((memory) => memory.id !== id),
      searchResults: state.searchResults.filter((memory) => memory.id !== id),
      totalCount: Math.max(0, state.totalCount - 1),
    })),
  setLoading: (value) => set({ isLoading: value }),
  setSearching: (value) => set({ isSearching: value }),
  setError: (error) => set({ error }),
  clearSearch: () => set({ searchResults: [], searchQuery: '' }),
}))

export default useMemoryStore
