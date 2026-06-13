'use client'

import { useMemo, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { getFileContent, openWorkspace } from '@/services/api'
import { useDeveloperStore } from '@/store/developer-store'
import { useUIStore } from '@/store/ui-store'
import type { FileNode } from '@/types'
import { CodeViewer } from './code-viewer'
import { FileTabs } from './file-tabs'
import { FileTree } from './file-tree'
import { WorkspaceOpener } from './workspace-opener'

export function DeveloperWorkspace(): JSX.Element {
  const {
    workspace,
    openedFiles,
    activeFilePath,
    openFile,
    closeFile,
    setActiveFile,
    setWorkspace,
    clearWorkspace,
  } = useDeveloperStore()
  const { explorerPanelWidth } = useUIStore()
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const activeFile = useMemo(
    () => openedFiles.find((file) => file.path === activeFilePath) ?? null,
    [activeFilePath, openedFiles]
  )

  async function handleFileClick(node: FileNode): Promise<void> {
    if (node.type !== 'file') return

    setFileLoading(true)
    setFileError(null)

    try {
      const content = await getFileContent(node.path)
      openFile({
        path: content.path,
        name: content.name,
        language: content.language,
        content: content.content,
        lines: content.lines,
        size: content.size,
      })
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Unable to open file.')
    } finally {
      setFileLoading(false)
    }
  }

  async function handleRefresh(): Promise<void> {
    if (!workspace.rootPath || isRefreshing) return
    setIsRefreshing(true)
    try {
      const data = await openWorkspace(workspace.rootPath)
      setWorkspace({
        tree: data.tree,
        fileCount: data.file_count,
        languages: data.languages,
      })
    } catch {
      // silently fail — tree stays as-is
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!workspace.rootPath) {
    return <WorkspaceOpener />
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      {/* Workspace header */}
      <div className="h-10 shrink-0 items-center border-b border-slate-800 px-3 text-xs font-medium uppercase tracking-wider text-slate-400 flex">
        <div className="min-w-0 flex-1 truncate">
          {workspace.rootName}
          <span className="ml-3 font-normal normal-case tracking-normal text-slate-500">
            {workspace.fileCount} files
            {workspace.languages.length > 0 ? ` - ${workspace.languages.join(', ')}` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={clearWorkspace}
          className="rounded p-1 text-slate-500 hover:bg-slate-800/60 hover:text-slate-100"
          aria-label="Close workspace"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* File explorer sidebar */}
        <aside
          className="min-h-0 shrink-0 border-r border-slate-800 bg-slate-900"
          style={{ width: explorerPanelWidth }}
        >
          <div className="h-10 flex items-center px-3 border-b border-slate-800 text-xs font-medium text-slate-400 uppercase tracking-wider">
            <span className="flex-1">Explorer</span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded p-1 text-slate-500 hover:bg-slate-800/60 hover:text-slate-100 disabled:opacity-40"
              aria-label="Refresh file tree"
              title="Refresh file tree"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="h-[calc(100%-2.5rem)] min-h-0">
            <FileTree
              tree={workspace.tree}
              activePath={activeFilePath}
              onFileClick={handleFileClick}
            />
          </div>
        </aside>

        {/* Code viewer */}
        <main className="flex min-w-0 flex-1 flex-col bg-slate-950">
          {openedFiles.length > 0 ? (
            <FileTabs
              openedFiles={openedFiles}
              activeFilePath={activeFilePath}
              onTabClick={(path) => {
                setActiveFile(path)
                setFileError(null)
              }}
              onTabClose={closeFile}
            />
          ) : null}
          <div className="min-h-0 flex-1">
            <CodeViewer file={activeFile} isLoading={fileLoading} error={fileError} />
          </div>
        </main>
      </div>
    </div>
  )
}

export default DeveloperWorkspace