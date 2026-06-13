export interface DocumentItem {
  id: string
  name: string
  size: number
  fileType: string
  uploadedAt: string
  chunkCount: number
}

export interface DocumentListResponse {
  documents: DocumentItem[]
  total: number
}
