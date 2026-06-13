'use client'

import { X } from 'lucide-react'
import type { OpenedFile } from '@/types'

interface FileTabsProps {
  openedFiles: OpenedFile[]
  activeFilePath: string | null
  onTabClick: (path: string) => void
  onTabClose: (path: string) => void
}

export function FileTabs({
  openedFiles,
  activeFilePath,
  onTabClick,
  onTabClose,
}: FileTabsProps): JSX.Element {
  return (
    <div className="flex h-10 overflow-x-auto border-b border-slate-800 bg-slate-900 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
      {openedFiles.map((file) => {
        const isActive = file.path === activeFilePath

        return (
          <div
            key={file.path}
            className={`group flex min-w-0 max-w-56 shrink-0 items-center border-r border-slate-800 ${
              isActive
                ? 'border-b-2 border-b-blue-500 bg-slate-800 text-white'
                : 'bg-slate-900/50 text-slate-400 hover:text-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => onTabClick(file.path)}
              className="min-w-0 flex-1 truncate px-3 text-left text-sm"
              title={file.path}
            >
              {file.name}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onTabClose(file.path)
              }}
              className="mr-2 rounded p-0.5 text-slate-500 opacity-0 hover:bg-slate-700 hover:text-slate-100 group-hover:opacity-100"
              aria-label={`Close ${file.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default FileTabs
