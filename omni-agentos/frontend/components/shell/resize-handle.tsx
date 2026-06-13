'use client'

export interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void
}

export function ResizeHandle({ onMouseDown }: ResizeHandleProps): JSX.Element {
  return (
    <div
      onMouseDown={onMouseDown}
      className="h-1 w-full cursor-row-resize hover:bg-accent-blue/50 transition-colors group"
      role="separator"
      aria-label="Resize terminal panel"
    >
      <div className="h-full w-full bg-slate-800/50 group-hover:bg-accent-blue/30" />
    </div>
  )
}

export default ResizeHandle
