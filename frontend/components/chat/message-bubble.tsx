'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Bot, Check, Copy, Sparkles, User, ChevronDown, ChevronRight, Loader2, Edit2, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Maximize2 } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Components } from 'react-markdown'
import { agentStyle } from '@/lib/agent-styles'
import type { Message } from '@/types'

const codeStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...(oneDark['pre[class*="language-"]'] ?? {}),
    background: '#1A1A1A',
    border: '1px solid #3A3A3A',
    borderRadius: '8px',
    margin: '0.75rem 0',
  },
}

function CodeBlock({ language, code }: { language: string; code: string }): JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy code block:', err)
    }
  }

  const { setActiveArtifact } = useUIStore()
  const lines = code.split('\n')
  const isLarge = lines.length > 15

  const handleOpenArtifact = () => {
    setActiveArtifact({ title: 'Code Artifact', content: code, language })
  }

  if (isLarge) {
    return (
      <div className="my-3 flex items-center justify-between rounded-lg border border-border-default bg-bg-raised p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-bg-surface">
            <span className="font-mono text-xs text-accent">{language}</span>
          </div>
          <div>
            <div className="text-sm font-medium text-text-primary">Large Code Block</div>
            <div className="text-xs text-text-muted">{lines.length} lines</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded border border-border-default bg-bg-surface text-text-muted transition hover:border-accent/40 hover:text-text-primary"
            title="Copy code"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-status-green" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleOpenArtifact}
            className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-bg-base transition hover:bg-accent-hover"
          >
            <Maximize2 className="h-3 w-3" />
            View Artifact
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group/code relative my-3">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
        <span className="select-none font-mono text-[10px] uppercase text-text-muted">
          {language}
        </span>
        <button
          type="button"
          onClick={handleOpenArtifact}
          className="flex h-6 w-6 items-center justify-center rounded border border-border-default bg-bg-raised text-text-muted transition hover:border-accent/40 hover:bg-bg-surface hover:text-text-primary"
          title="Open in Artifacts"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-6 w-6 items-center justify-center rounded border border-border-default bg-bg-raised text-text-muted transition hover:border-accent/40 hover:bg-bg-surface hover:text-text-primary"
          aria-label="Copy code block"
          title="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-status-green" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <SyntaxHighlighter
        PreTag="div"
        language={language}
        style={codeStyle}
        showLineNumbers
        lineNumberStyle={{ color: '#6B6B6B', fontSize: '0.7rem' }}
        customStyle={{ borderRadius: '8px', margin: 0, paddingRight: '4.5rem' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '')
    const code = String(children).replace(/\n$/, '')
    if (match) {
      return <CodeBlock language={match[1]} code={code} />
    }
    return (
      <code className="rounded border border-border-default bg-bg-base px-1.5 py-0.5 font-mono text-xs text-accent" {...props}>
        {children}
      </code>
    )
  },
  p: ({ children }) => <p className="mb-3 leading-7 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-6 text-text-secondary">{children}</li>,
  h1: ({ children }) => <h1 className="mb-3 mt-4 text-lg font-semibold text-text-primary">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold text-text-primary">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-semibold text-text-primary">{children}</h3>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/40 pl-4 italic text-text-secondary">{children}</blockquote>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-accent underline underline-offset-2 hover:text-accent-hover"
    >
      {children}
    </a>
  ),
}

function ToolCallAccordion({ toolCall }: { toolCall: NonNullable<Message['toolCalls']>[0] }): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-2 overflow-hidden rounded border border-border-default bg-bg-base/50">
      <button 
        type="button" 
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-xs transition hover:bg-bg-surface"
      >
        <div className="flex items-center gap-2">
          {toolCall.status === 'running' ? (
            <Loader2 className="h-3 w-3 animate-spin text-accent" />
          ) : toolCall.status === 'error' ? (
            <AlertCircle className="h-3 w-3 text-status-red" />
          ) : (
            <Check className="h-3 w-3 text-status-green" />
          )}
          <span className="font-mono text-text-secondary">{toolCall.tool}</span>
        </div>
        {open ? <ChevronDown className="h-3 w-3 text-text-muted" /> : <ChevronRight className="h-3 w-3 text-text-muted" />}
      </button>
      {open && (
        <div className="border-t border-border-default p-2 text-[10px] font-mono text-text-muted">
          <div className="mb-1 text-text-secondary">Args:</div>
          <pre className="mb-2 whitespace-pre-wrap rounded bg-bg-surface p-1.5">{JSON.stringify(toolCall.args, null, 2)}</pre>
          {toolCall.result && (
            <>
              <div className="mb-1 text-text-secondary">Result:</div>
              <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-bg-surface p-1.5">{toolCall.result}</pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export interface MessageBubbleProps {
  message: Message
  agentName?: string
  onRegenerate?: () => void
  onEditSubmit?: (messageId: string, newContent: string) => void
}

export function MessageBubble({ message, agentName, onRegenerate, onEditSubmit }: MessageBubbleProps): JSX.Element {
  const [copiedMessage, setCopiedMessage] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  if (message.role === 'system') {
    return (
      <div className="flex justify-center px-6 py-2">
        <span className="rounded-full border border-border-default bg-bg-surface px-3 py-1 text-xs text-text-muted">
          {message.content}
        </span>
      </div>
    )
  }

  const isUser = message.role === 'user'
  const activeAgent = message.agentName ?? agentName
  const agentStyleInfo = activeAgent ? agentStyle(activeAgent.toLowerCase()) : null

  const handleCopyMessage = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedMessage(true)
      setTimeout(() => setCopiedMessage(false), 1500)
    } catch (err) {
      console.error('Failed to copy message:', err)
    }
  }

  const handleEditSave = () => {
    if (editContent.trim() !== message.content && onEditSubmit) {
      onEditSubmit(message.id, editContent)
    }
    setIsEditing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex min-w-0 items-end gap-3 px-3 py-2 sm:px-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
          isUser ? 'border-accent/20 bg-accent/10' : 'border-border-default bg-bg-raised'
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5 text-accent" /> : <Sparkles className="h-3.5 w-3.5 text-text-muted" />}
      </div>

      <div className="flex min-w-0 max-w-[calc(100%-3rem)] flex-col sm:max-w-[78%]">
        {!isUser && activeAgent && agentStyleInfo && (
          <div className="mb-1 flex items-center gap-1.5 px-0.5">
            <span className="inline-flex items-center gap-1 rounded border border-border-default bg-bg-raised px-1.5 py-0.5 text-[10px] font-medium">
              <Bot className={`h-2.5 w-2.5 ${agentStyleInfo.color}`} />
              <span className={agentStyleInfo.color}>{agentStyleInfo.label}</span>
            </span>
          </div>
        )}

        <div
          className={`group relative min-w-0 overflow-hidden px-4 py-3 text-sm leading-7 ${
            isUser ? 'text-text-primary' : 'text-text-secondary'
          } ${message.error ? 'border border-status-red/30 bg-status-red/10' : ''}`}
          style={
            !message.error
              ? isUser
                ? {
                    background: 'rgba(16,163,127,0.12)',
                    border: '1px solid rgba(16,163,127,0.20)',
                    borderRadius: '12px 12px 4px 12px',
                  }
                : {
                    background: '#2A2A2A',
                    border: '1px solid #3A3A3A',
                    borderRadius: '12px 12px 12px 4px',
                  }
              : undefined
          }
        >
          {isUser && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded border border-border-default bg-bg-raised text-text-muted opacity-50 shadow-sm transition hover:border-accent/40 hover:bg-bg-surface hover:text-text-primary hover:opacity-100"
              aria-label="Edit message"
              title="Edit message"
            >
              <Edit2 className="h-3 w-3" />
            </button>
          )}

          {!isUser && !message.isStreaming && !message.error && onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="absolute right-10 top-2 z-10 flex h-6 w-6 items-center justify-center rounded border border-border-default bg-bg-raised text-text-muted opacity-50 shadow-sm transition hover:border-accent/40 hover:bg-bg-surface hover:text-text-primary hover:opacity-100"
              aria-label="Regenerate message"
              title="Regenerate message"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}

          {!isUser && !message.isStreaming && !message.error && message.content && (
            <button
              type="button"
              onClick={handleCopyMessage}
              className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded border border-border-default bg-bg-raised text-text-muted opacity-50 shadow-sm transition hover:border-accent/40 hover:bg-bg-surface hover:text-text-primary hover:opacity-100"
              aria-label="Copy message"
              title="Copy message"
            >
              {copiedMessage ? <Check className="h-3 w-3 text-status-green" /> : <Copy className="h-3 w-3" />}
            </button>
          )}

          {message.toolCalls?.map((tc, idx) => (
            <ToolCallAccordion key={`${tc.tool}-${idx}`} toolCall={tc} />
          ))}

          {message.error ? (
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-red" />
              <div>
                {message.content && <p className="mb-1.5 text-text-secondary">{message.content}</p>}
                <p className="text-status-red/90">{message.error}</p>
              </div>
            </div>
          ) : message.isStreaming && message.content === '' ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
            </div>
          ) : message.isStreaming ? (
            <div className="prose-custom min-w-0 break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
              <span className="streaming-cursor inline-block" />
            </div>
          ) : isUser ? (
            isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full resize-none rounded-lg border border-border-default bg-bg-base p-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                  rows={Math.max(3, editContent.split('\n').length)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditContent(message.content)
                    }}
                    className="rounded px-3 py-1 text-xs text-text-muted hover:bg-bg-raised hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    className="rounded bg-accent px-3 py-1 text-xs text-bg-base hover:bg-accent-hover"
                  >
                    Save & Submit
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words pr-6">{message.content}</p>
            )
          ) : !isUser && !message.content && (!message.toolCalls || message.toolCalls.length === 0) ? (
            <p className="select-none text-xs italic text-text-muted">Generation stopped</p>
          ) : (
            <div className="prose-custom min-w-0 break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default MessageBubble
