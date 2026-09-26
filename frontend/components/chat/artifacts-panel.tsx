import { X, Check, Copy, Maximize2, Minimize2 } from 'lucide-react'
import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useUIStore } from '@/store/ui-store'

const codeStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...(oneDark['pre[class*="language-"]'] ?? {}),
    background: '#1A1A1A',
    border: 'none',
    margin: '0',
    height: '100%',
  },
}

export function ArtifactsPanel(): JSX.Element | null {
  const { artifactsPanelOpen, setArtifactsPanelOpen, activeArtifact, artifactsPanelFullScreen, setArtifactsPanelFullScreen } = useUIStore()
  const [copied, setCopied] = useState(false)

  if (!artifactsPanelOpen || !activeArtifact) return null

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(activeArtifact.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy code block:', err)
    }
  }

  return (
    <div className="flex h-full w-full flex-col border-l border-border-default bg-bg-base">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-default px-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-primary">{activeArtifact.title}</span>
          <span className="rounded bg-bg-surface px-1.5 py-0.5 text-[10px] uppercase text-text-muted">
            {activeArtifact.language}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setArtifactsPanelFullScreen(!artifactsPanelFullScreen)}
            className="flex h-7 w-7 items-center justify-center rounded transition hover:bg-bg-raised text-text-muted hover:text-text-primary"
            title={artifactsPanelFullScreen ? "Restore" : "Maximize"}
          >
            {artifactsPanelFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded transition hover:bg-bg-raised text-text-muted hover:text-text-primary"
            title="Copy"
          >
            {copied ? <Check className="h-4 w-4 text-status-green" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={() => {
              setArtifactsPanelOpen(false)
              setArtifactsPanelFullScreen(false)
            }}
            className="flex h-7 w-7 items-center justify-center rounded transition hover:bg-bg-raised text-text-muted hover:text-text-primary"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-[#1A1A1A]">
        <SyntaxHighlighter
          PreTag="div"
          language={activeArtifact.language}
          style={codeStyle}
          showLineNumbers
          lineNumberStyle={{ color: '#6B6B6B', fontSize: '0.7rem' }}
          customStyle={{ padding: '1rem', minHeight: '100%' }}
        >
          {activeArtifact.content}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
