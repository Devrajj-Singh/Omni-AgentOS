'use client'

import { FileCode } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { OpenedFile } from '@/types'

interface CodeViewerProps {
  file: OpenedFile | null
  isLoading?: boolean
  error?: string | null
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function CodeViewer({ file, isLoading = false, error = null }: CodeViewerProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="h-full bg-slate-950 p-5">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-slate-800" />
        <div className="space-y-2">
          {Array.from({ length: 14 }).map((_, index) => (
            <div
              key={index}
              className="h-4 animate-pulse rounded bg-slate-800"
              style={{ width: `${70 + (index % 4) * 7}%` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 p-6 text-center">
        <div>
          <FileCode className="mx-auto mb-3 h-10 w-10 text-red-400" />
          <p className="text-sm font-medium text-slate-100">Unable to open file</p>
          <p className="mt-2 max-w-md text-sm text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 p-6 text-center">
        <div>
          <FileCode className="mx-auto mb-3 h-12 w-12 text-slate-600" />
          <p className="text-sm text-slate-400">Select a file to view its contents</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-slate-800 px-3 text-xs text-slate-400">
        <span className="truncate font-medium text-slate-100">{file.name}</span>
        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-blue-400">
          {file.language}
        </span>
        <span>{file.lines} lines</span>
        <span>{formatBytes(file.size)}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
        <SyntaxHighlighter
          language={file.language}
          style={oneDark}
          showLineNumbers
          customStyle={{
            margin: 0,
            minHeight: '100%',
            background: '#020617',
            fontSize: '0.875rem',
          }}
          codeTagProps={{ style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
        >
          {file.content}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

export default CodeViewer
