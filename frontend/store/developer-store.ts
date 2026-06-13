import { create } from 'zustand'
import type { OpenedFile, WorkspaceState } from '@/types'

const emptyWorkspace: WorkspaceState = {
  rootPath: null,
  rootName: null,
  tree: [],
  fileCount: 0,
  languages: [],
  isLoading: false,
  error: null,
}

interface DeveloperState {
  workspace: WorkspaceState
  openedFiles: OpenedFile[]
  activeFilePath: string | null
  setWorkspace: (data: Partial<WorkspaceState>) => void
  openFile: (file: OpenedFile) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  clearWorkspace: () => void
}

export const useDeveloperStore = create<DeveloperState>()((set) => ({
  workspace: emptyWorkspace,
  openedFiles: [],
  activeFilePath: null,

  setWorkspace: (data) =>
    set((state) => ({
      workspace: { ...state.workspace, ...data },
    })),

  openFile: (file) =>
    set((state) => {
      if (state.openedFiles.some((openedFile) => openedFile.path === file.path)) {
        return { activeFilePath: file.path }
      }

      const openedFiles =
        state.openedFiles.length >= 8
          ? [...state.openedFiles.slice(1), file]
          : [...state.openedFiles, file]

      return {
        openedFiles,
        activeFilePath: file.path,
      }
    }),

  closeFile: (path) =>
    set((state) => {
      const closingIndex = state.openedFiles.findIndex((file) => file.path === path)
      const openedFiles = state.openedFiles.filter((file) => file.path !== path)

      if (state.activeFilePath !== path) {
        return { openedFiles }
      }

      const nextActiveFile =
        openedFiles[Math.max(0, closingIndex - 1)] ?? openedFiles[openedFiles.length - 1] ?? null

      return {
        openedFiles,
        activeFilePath: nextActiveFile?.path ?? null,
      }
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  clearWorkspace: () =>
    set({
      workspace: emptyWorkspace,
      openedFiles: [],
      activeFilePath: null,
    }),
}))

export default useDeveloperStore
