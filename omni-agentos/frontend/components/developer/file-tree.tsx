'use client'

import type { FileNode } from '@/types'
import { FileTreeNode } from './file-tree-node'

interface FileTreeProps {
  tree: FileNode[]
  activePath: string | null
  onFileClick: (node: FileNode) => void
}

export function FileTree({ tree, activePath, onFileClick }: FileTreeProps): JSX.Element {
  if (tree.length === 0) {
    return <div className="px-3 py-4 text-sm text-slate-500">No files</div>
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
      {tree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          activePath={activePath}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  )
}

export default FileTree
