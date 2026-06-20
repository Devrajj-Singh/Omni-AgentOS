'use client'

import { useEffect, useState } from 'react'
import { FileText, MessageSquare } from 'lucide-react'
import { deleteDocument, listDocuments } from '@/services/api'
import type { DocumentItem } from '@/types'
import { DocumentList } from './document-list'
import { DocumentUpload } from './document-upload'
import { ResearchChat } from './research-chat'

export function ResearchWorkspace(): JSX.Element {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'docs'>('chat')

  useEffect(() => {
    listDocuments()
      .then((res) => setDocuments(res.documents))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  const handleUpload = (doc: DocumentItem): void => {
    setDocuments((prev) => [doc, ...prev])
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm('Delete this document?')) return
    await deleteDocument(id)
    setDocuments((prev) => prev.filter((doc) => doc.id !== id))
  }

  return (
    <div className="flex h-full flex-col bg-bg-base">
      <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-default px-4 py-2 sm:h-14 sm:px-6 sm:py-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <h1 className="text-sm font-semibold text-text-primary">Research</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border-default bg-bg-surface p-0.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobilePanel('chat')}
              className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors ${
                mobilePanel === 'chat' ? 'bg-accent/10 text-accent' : 'text-text-muted'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </button>
            <button
              type="button"
              onClick={() => setMobilePanel('docs')}
              className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors ${
                mobilePanel === 'docs' ? 'bg-accent/10 text-accent' : 'text-text-muted'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Docs
            </button>
          </div>
          <span className="rounded-full border border-border-default bg-bg-surface px-2.5 py-0.5 text-xs text-text-muted">
            {documents.length} documents
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 lg:flex-row">
        <aside
          className={`min-h-0 w-full shrink-0 flex-col border-b border-border-default bg-bg-surface lg:flex lg:w-80 lg:border-b-0 lg:border-r ${
            mobilePanel === 'docs' ? 'flex' : 'hidden'
          }`}
        >
          <div className="border-b border-border-default px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Document Library
            </p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
            <DocumentUpload onUpload={handleUpload} />
            <DocumentList documents={documents} onDelete={handleDelete} isLoading={isLoading} />
          </div>
        </aside>

        <main className={`min-w-0 flex-1 flex-col ${mobilePanel === 'chat' ? 'flex' : 'hidden'} lg:flex`}>
          <ResearchChat documentCount={documents.length} />
        </main>
      </div>
    </div>
  )
}

export default ResearchWorkspace
