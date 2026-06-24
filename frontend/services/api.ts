import type {
  FileContent,
  MemoryListResponse,
  MemorySearchResponse,
  MemoryStats,
  Message,
  DocumentItem,
  DocumentListResponse,
  AppSettings,
  EventsResponse,
  TaskListResponse,
  WorkspaceResponse,
} from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

export async function sendChatMessage(
  sessionId: string,
  message: string,
  conversationHistory: Message[],
  workspacePath?: string | null,
  activeFilePath?: string | null,
  autonomousMode?: boolean,
  recentlyOpenedFiles?: string[]
): Promise<{ task_id: string; status: string }> {
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      conversation_history: conversationHistory.map((historyMessage) => ({
        id: historyMessage.id,
        role: historyMessage.role,
        content: historyMessage.content,
        is_streaming: historyMessage.isStreaming,
        created_at: historyMessage.createdAt,
      })),
      workspace_path: workspacePath ?? null,
      active_file_path: activeFilePath ?? null,
      autonomous_mode: autonomousMode ?? false,
      recently_opened_files: recentlyOpenedFiles ?? [],
    }),
  })

  if (!res.ok) throw new Error(`Chat request failed: ${res.status}`)
  return res.json() as Promise<{ task_id: string; status: string }>
}

export async function resolveApproval(
  approvalId: string,
  sessionId: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/approval/${approvalId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, decision }),
  })

  if (!res.ok) throw new Error(`Approval resolution failed: ${res.status}`)
}

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: string }
    return data.detail || fallback
  } catch {
    return fallback
  }
}

export async function openWorkspace(path: string): Promise<WorkspaceResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/workspace/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Open workspace failed: ${res.status}`))
  }

  return res.json() as Promise<WorkspaceResponse>
}

export async function getFileContent(path: string): Promise<FileContent> {
  const params = new URLSearchParams({ path })
  const res = await fetch(`${BASE_URL}/api/v1/workspace/file?${params.toString()}`)

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `File request failed: ${res.status}`))
  }

  return res.json() as Promise<FileContent>
}

export async function searchMemories(
  query: string,
  limit = 10
): Promise<MemorySearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  const res = await fetch(`${BASE_URL}/api/v1/memory/search?${params.toString()}`)

  if (!res.ok) throw new Error(`Memory search failed: ${res.status}`)

  const data = (await res.json()) as {
    results: Array<{
      id: string
      user_message: string
      assistant_message: string
      timestamp: string
      session_id: string
      workspace_path: string
      relevance: number
    }>
    total: number
  }

  return {
    results: data.results.map((result) => ({
      id: result.id,
      userMessage: result.user_message,
      assistantMessage: result.assistant_message,
      timestamp: result.timestamp,
      sessionId: result.session_id,
      workspacePath: result.workspace_path,
      relevance: result.relevance,
    })),
    total: data.total,
  }
}

export async function listMemories(limit = 100, offset = 0): Promise<MemoryListResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const res = await fetch(`${BASE_URL}/api/v1/memory?${params.toString()}`)

  if (!res.ok) throw new Error(`List memories failed: ${res.status}`)

  const data = (await res.json()) as {
    memories: Array<{
      id: string
      user_message: string
      assistant_message: string
      timestamp: string
      session_id: string
      workspace_path: string
    }>
    total: number
    count: number
  }

  return {
    memories: data.memories.map((memory) => ({
      id: memory.id,
      userMessage: memory.user_message,
      assistantMessage: memory.assistant_message,
      timestamp: memory.timestamp,
      sessionId: memory.session_id,
      workspacePath: memory.workspace_path,
      relevance: 0,
    })),
    total: data.total,
    count: data.count,
  }
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/memory/${memoryId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete memory failed: ${res.status}`)
}

export async function uploadDocument(file: File): Promise<DocumentItem> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${BASE_URL}/api/v1/research/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(err.detail || `Upload failed: ${res.status}`)
  }

  const data = (await res.json()) as {
    id: string
    name: string
    size: number
    file_type: string
    uploaded_at: string
    chunk_count: number
  }

  return {
    id: data.id,
    name: data.name,
    size: data.size,
    fileType: data.file_type,
    uploadedAt: data.uploaded_at,
    chunkCount: data.chunk_count,
  }
}

export async function listDocuments(): Promise<DocumentListResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/research/documents`)
  if (!res.ok) throw new Error(`Failed to list documents: ${res.status}`)

  const data = (await res.json()) as {
    documents: Array<{
      id: string
      name: string
      size: number
      file_type: string
      uploaded_at: string
      chunk_count: number
    }>
    total: number
  }

  return {
    documents: data.documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      fileType: doc.file_type,
      uploadedAt: doc.uploaded_at,
      chunkCount: doc.chunk_count,
    })),
    total: data.total,
  }
}

export async function deleteDocument(docId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/research/documents/${docId}`, {
    method: 'DELETE',
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Failed to delete document: ${res.status}`))
  }
}

export async function getMemoryStats(): Promise<MemoryStats> {
  const res = await fetch(`${BASE_URL}/api/v1/memory/stats`)

  if (!res.ok) throw new Error(`Memory stats failed: ${res.status}`)

  const data = (await res.json()) as { total_memories: number; status: string }
  return { totalMemories: data.total_memories, status: data.status }
}

export async function getSettings(): Promise<AppSettings> {
  const res = await fetch(`${BASE_URL}/api/v1/settings`)
  if (!res.ok) throw new Error(`Failed to load settings: ${res.status}`)

  const data = (await res.json()) as {
    active_model: string
    available_models: Array<{
      id: string
      name: string
      description: string
      provider: string
      speed: string
    }>
    memory_count: number
    max_file_size_kb: number
    excluded_dirs: string[]
  }

  return {
    activeModel: data.active_model,
    availableModels: data.available_models.map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      provider: model.provider,
      speed: model.speed as 'instant' | 'fast' | 'slow',
    })),
    memoryCount: data.memory_count,
    maxFileSizeKb: data.max_file_size_kb,
    excludedDirs: data.excluded_dirs,
  }
}

export async function updateModel(modelId: string): Promise<{ activeModel: string }> {
  const res = await fetch(`${BASE_URL}/api/v1/settings/model`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId }),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Failed to update model: ${res.status}`))
  }

  const data = (await res.json()) as { active_model: string }
  return { activeModel: data.active_model }
}

export async function clearAllMemories(): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE_URL}/api/v1/settings/memory/all`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to clear memories: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

export async function exportMemories(): Promise<object> {
  const res = await fetch(`${BASE_URL}/api/v1/settings/memory/export`)
  if (!res.ok) throw new Error(`Failed to export memories: ${res.status}`)
  return res.json() as Promise<object>
}

export async function listObservabilityTasks(): Promise<TaskListResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/observability/tasks`)
  if (!res.ok) throw new Error(`Failed to list tasks: ${res.status}`)
  return res.json() as Promise<TaskListResponse>
}

export async function getTaskEvents(taskId: string): Promise<EventsResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/observability/tasks/${taskId}`)
  if (!res.ok) throw new Error(`Failed to get task events: ${res.status}`)
  return res.json() as Promise<EventsResponse>
}

export async function listRecentEvents(limit = 200): Promise<EventsResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/observability/events?limit=${limit}`)
  if (!res.ok) throw new Error(`Failed to list events: ${res.status}`)
  return res.json() as Promise<EventsResponse>
}
