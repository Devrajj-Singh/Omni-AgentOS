'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'

interface MemorySearchBarProps {
  onSearch: (query: string) => void
  isSearching: boolean
}

export function MemorySearchBar({ onSearch, isSearching }: MemorySearchBarProps): JSX.Element {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSearch(query.trim())
    }, 400)

    return () => window.clearTimeout(timer)
  }, [onSearch, query])

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search memories semantically..."
        className="input-base h-11 w-full rounded-xl px-10 text-sm text-text-primary placeholder:text-text-muted"
      />
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
        {isSearching ? <Loader2 className="h-4 w-4 animate-spin text-text-secondary" /> : null}
        {query && !isSearching ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="rounded-lg p-1 text-text-muted hover:text-text-primary"
            style={{ background: 'transparent' }}
            aria-label="Clear memory search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default MemorySearchBar
