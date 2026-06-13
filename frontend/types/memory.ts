export interface MemoryItem {
  id: string
  userMessage: string
  assistantMessage: string
  timestamp: string
  sessionId: string
  workspacePath: string
  relevance: number
}

export interface MemorySearchResponse {
  results: MemoryItem[]
  total: number
}

export interface MemoryListResponse {
  memories: MemoryItem[]
  total: number
  count: number
}

export interface MemoryStats {
  totalMemories: number
  status: string
}
