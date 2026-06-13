'use client'

import { motion } from 'framer-motion'
import { AlertCircle, Sparkles, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Components } from 'react-markdown'
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

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '')
    const code = String(children).replace(/\n$/, '')
    if (match) {
      return (
        <SyntaxHighlighter
          PreTag="div"
          language={match[1]}
          style={codeStyle}
          showLineNumbers
          lineNumberStyle={{ color: '#6B6B6B', fontSize: '0.7rem' }}
          customStyle={{ borderRadius: '8px', margin: '0.75rem 0' }}
        >
          {code}
        </SyntaxHighlighter>
      )
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

export function MessageBubble({ message }: { message: Message }): JSX.Element {
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

      <div
        className={`relative min-w-0 max-w-[calc(100%-3rem)] overflow-hidden px-4 py-3 text-sm leading-7 sm:max-w-[78%] ${
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
        {message.error ? (
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-red" />
            <div>
              {message.content && <p className="mb-1.5 text-text-secondary">{message.content}</p>}
              <p className="text-status-red/90">{message.error}</p>
            </div>
          </div>
        ) : message.isStreaming ? (
          <p className="streaming-cursor whitespace-pre-wrap break-words text-text-secondary">{message.content}</p>
        ) : isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose-custom min-w-0 break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default MessageBubble
