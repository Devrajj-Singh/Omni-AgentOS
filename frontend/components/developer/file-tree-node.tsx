'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react'
import type { FileNode } from '@/types'

interface FileTreeNodeProps {
  node: FileNode
  depth: number
  activePath: string | null
  onFileClick: (node: FileNode) => void
}

const extensionColors: Record<string, string> = {
  ts: 'bg-blue-400',
  tsx: 'bg-blue-400',
  py: 'bg-yellow-400',
  md: 'bg-slate-400',
  json: 'bg-orange-400',
  css: 'bg-purple-400',
}

function FileDot({ extension }: { extension: string }): JSX.Element {
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${extensionColors[extension] ?? 'bg-white'}`}
      aria-hidden="true"
    />
  )
}

function TreeRow({
  icon: Icon,
  children,
  depth,
  isActive,
  onClick,
}: {
  icon?: LucideIcon
  children: React.ReactNode
  depth: number
  isActive: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 w-full items-center gap-1.5 truncate text-left text-sm hover:bg-slate-800/50 ${
        isActive ? 'bg-slate-700/50 text-white' : 'text-slate-300'
      }`}
      style={{ paddingLeft: depth * 12 + 8 }}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0 text-slate-400" /> : null}
      {children}
    </button>
  )
}

export function FileTreeNode({
  node,
  depth,
  activePath,
  onFileClick,
}: FileTreeNodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(depth === 0)
  const isDirectory = node.type === 'directory'
  const isActive = activePath === node.path

  if (isDirectory) {
    const Chevron = expanded ? ChevronDown : ChevronRight
    const FolderIcon = expanded ? FolderOpen : Folder

    return (
      <div>
        <TreeRow depth={depth} isActive={false} onClick={() => setExpanded((value) => !value)}>
          <Chevron className="h-4 w-4 shrink-0 text-slate-500" />
          <FolderIcon className="h-4 w-4 shrink-0 text-blue-400" />
          <span className="truncate text-sm text-slate-300">{node.name}</span>
        </TreeRow>

        {expanded
          ? node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                onFileClick={onFileClick}
              />
            ))
          : null}
      </div>
    )
  }

  return (
    <TreeRow icon={File} depth={depth} isActive={isActive} onClick={() => onFileClick(node)}>
      <FileDot extension={node.extension} />
      <span className="truncate">{node.name}</span>
    </TreeRow>
  )
}

export default FileTreeNode
