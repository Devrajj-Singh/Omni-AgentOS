'use client'

import { FormEvent, useState } from 'react'
import { AlertCircle, FolderOpen, Loader2 } from 'lucide-react'
import { openWorkspace } from '@/services/api'
import { useDeveloperStore } from '@/store/developer-store'

export function WorkspaceOpener(): JSX.Element {
  const [path, setPath] = useState('')
  const { workspace, setWorkspace } = useDeveloperStore()

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const trimmedPath = path.trim()
    if (!trimmedPath) {
      setWorkspace({ error: 'Enter a directory path.' })
      return
    }

    setWorkspace({ isLoading: true, error: null })

    try {
      const response = await openWorkspace(trimmedPath)
      setWorkspace({
        rootPath: response.path,
        rootName: response.name,
        tree: response.tree,
        fileCount: response.file_count,
        languages: response.languages,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      setWorkspace({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unable to open workspace.',
      })
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6 animate-fade-up">
      <form onSubmit={handleSubmit} className="card w-full max-w-md p-8">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
          <FolderOpen className="h-5 w-5 text-accent" />
        </div>
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Open a Workspace</h2>
        <p className="mb-6 text-sm leading-relaxed text-text-muted">
          Enter the path to a directory to explore its files with AI
        </p>

        <input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="C:\\Users\\yourname\\project"
          className="input-field mb-4 w-full px-4 py-3 text-sm"
        />

        <button type="submit" disabled={workspace.isLoading} className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm">
          {workspace.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Open Workspace
        </button>
        {workspace.error ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-status-red">
            <AlertCircle className="h-3 w-3" />
            {workspace.error}
          </p>
        ) : null}
      </form>
    </div>
  )
}

export default WorkspaceOpener
