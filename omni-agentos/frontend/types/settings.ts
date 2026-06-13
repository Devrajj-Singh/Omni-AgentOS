export interface ModelInfo {
  id: string
  name: string
  description: string
  provider: string
  speed: 'instant' | 'fast' | 'slow'
}

export interface AppSettings {
  activeModel: string
  availableModels: ModelInfo[]
  memoryCount: number
  maxFileSizeKb: number
  excludedDirs: string[]
}
