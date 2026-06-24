'use client'

import { useCallback, useEffect } from 'react'
import { Brain, RefreshCw } from 'lucide-react'
import { deleteMemory, listMemories, searchMemories } from '@/services/api'
import { wsService } from '@/services/websocket'
import { useMemoryStore } from '@/store/memory-store'
import type { MemoryItem, WSEventType } from '@/types'
import { MemoryCard } from './memory-card'
import { MemoryEmptyState } from './memory-empty-state'
import { MemorySearchBar } from './memory-search-bar'

function MemorySkeleton(): JSX.Element {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-40 animate-pulse rounded-lg border border-border-default bg-bg-surface" />
      ))}
    </div>
  )
}

export function MemoryWorkspace(): JSX.Element {
  const {
    memories,
    searchResults,
    totalCount,
    isLoading,
    isSearching,
    searchQuery,
    error,
    setMemories,
    setSearchResults,
    setSearchQuery,
    removeMemory,
    setLoading,
    setSearching,
    setError,
    clearSearch,
  } = useMemoryStore()

  const loadMemories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const listResponse = await listMemories()
      const sorted = [...listResponse.memories]
        .filter((m) => !m.sessionId.startsWith('doc:'))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setMemories(sorted, listResponse.total)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load memories.')
    } finally {
      setLoading(false)
    }
  }, [setError, setLoading, setMemories])

  useEffect(() => {
    void loadMemories()
  }, [loadMemories])

  useEffect(() => {
    // Root cause: the list was loaded only on mount while chat completion
    // happened over WebSocket, so a mounted Memory page could show a stale list.
    const unsubComplete = wsService.on('task.complete' as WSEventType, () => {
      void loadMemories()
    })

    const pollInterval = setInterval(() => {
      if (!isLoading) void loadMemories()
    }, 30000)

    const handleFocus = (): void => {
      void loadMemories()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      unsubComplete()
      clearInterval(pollInterval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isLoading, loadMemories])

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query) {
        clearSearch()
        return
      }

      setSearchQuery(query)
      setSearching(true)
      setError(null)

      try {
        const response = await searchMemories(query)
        setSearchResults(response.results)
      } catch (searchError) {
        setError(searchError instanceof Error ? searchError.message : 'Unable to search memories.')
      } finally {
        setSearching(false)
      }
    },
    [clearSearch, setError, setSearchQuery, setSearchResults, setSearching]
  )

  async function handleDelete(id: string): Promise<void> {
    setError(null)

    try {
      await deleteMemory(id)
      removeMemory(id)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete memory.')
    }
  }

  const visibleMemories: MemoryItem[] = searchQuery ? searchResults : memories
  const countLabel = totalCount

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent animate-fade-up">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
            <Brain className="h-4 w-4 text-accent" />
          </div>
          <h1 className="text-sm font-semibold text-text-primary">Memory</h1>
        </div>
        <span className="rounded-full border border-border-default bg-bg-base px-3 py-1 text-xs text-text-muted">
          {countLabel} {countLabel === 1 ? 'memory' : 'memories'}
        </span>
      </header>

      <div className="shrink-0 border-b border-border-default p-4">
        <MemorySearchBar onSearch={handleSearch} isSearching={isSearching} />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-status-red/30 bg-status-red/10 p-3 text-sm text-red-200">
            <span className="min-w-0 flex-1">{error}</span>
            <button
              type="button"
              onClick={() => void loadMemories()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-400/30 px-2 py-1 text-xs hover:bg-red-500/20"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : null}

        {isLoading ? <MemorySkeleton /> : null}

        {!isLoading && visibleMemories.length === 0 ? (
          <MemoryEmptyState />
        ) : (
          <div className="space-y-3">
            {visibleMemories.map((memory, index) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                index={index}
                onDelete={(memoryId) => void handleDelete(memoryId)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default MemoryWorkspace
