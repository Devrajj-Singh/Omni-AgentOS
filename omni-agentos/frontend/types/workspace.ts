import type { Message } from './message'

export interface Workspace {
  id: string
  name: string
  projectPath?: string
  openFiles: string[]
  conversationHistory: Message[]
  activeTaskId?: string
  memoryScope: string
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  extension: string
  children: FileNode[]
  size: number
}

export interface WorkspaceState {
  rootPath: string | null
  rootName: string | null
  tree: FileNode[]
  fileCount: number
  languages: string[]
  isLoading: boolean
  error: string | null
}

export interface FileContent {
  path: string
  name: string
  extension: string
  content: string
  size: number
  lines: number
  language: string
}

export interface OpenedFile {
  path: string
  name: string
  language: string
  content: string
  lines: number
  size: number
}

export interface WorkspaceResponse {
  path: string
  name: string
  tree: FileNode[]
  file_count: number
  languages: string[]
}
