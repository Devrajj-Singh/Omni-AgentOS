'use client'

import { FileText, Loader2, Trash2 } from 'lucide-react'
import type { DocumentItem } from '@/types'

interface DocumentListProps {
  documents: DocumentItem[]
  onDelete: (id: string) => void
  isLoading: boolean
}

export function DocumentList({ documents, onDelete, isLoading }: DocumentListProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <FileText className="h-8 w-8 text-text-muted" />
        <p className="text-sm text-text-muted">No documents uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-surface px-4 py-3"
        >
          <FileText className="h-4 w-4 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium text-text-primary">{doc.name}</p>
              <span className="shrink-0 rounded border border-border-default bg-bg-raised px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                {doc.fileType}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              {doc.chunkCount} chunks - {(doc.size / 1024).toFixed(1)}KB -{' '}
              {new Date(doc.uploadedAt).toLocaleDateString()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDelete(doc.id)}
            className="shrink-0 text-text-muted transition-colors hover:text-status-red"
            aria-label={`Delete ${doc.name}`}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

export default DocumentList
