'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { uploadDocument } from '@/services/api'
import type { DocumentItem } from '@/types'

interface DocumentUploadProps {
  onUpload: (doc: DocumentItem) => void
}

export function DocumentUpload({ onUpload }: DocumentUploadProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = async (file: File): Promise<void> => {
    setUploading(true)
    setError(null)

    try {
      const doc = await uploadDocument(file)
      onUpload(doc)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void uploadFile(file)
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file) void uploadFile(file)
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
          dragging
            ? 'border-accent bg-accent/5'
            : 'border-border-default hover:border-border-strong hover:bg-bg-raised'
        } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        ) : (
          <Upload className="h-8 w-8 text-text-muted" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-text-secondary">
            {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            PDF, Word, PowerPoint, Excel, code files, text - max 20MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".txt,.md,.rst,.log,.py,.ts,.tsx,.js,.jsx,.java,.go,.rs,.cpp,.c,.h,.cs,.rb,.sh,.yaml,.yml,.toml,.json,.csv,.xml,.html,.pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls"
          onChange={handleFileInput}
        />
      </div>
      {error && <p className="text-xs text-status-red">{error}</p>}
    </div>
  )
}

export default DocumentUpload
