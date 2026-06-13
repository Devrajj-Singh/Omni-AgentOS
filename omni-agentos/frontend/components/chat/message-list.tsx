'use client'

import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import { MessageBubble } from './message-bubble'
import type { Message } from '@/types'

export interface MessageListProps {
  messages: Message[]
  onSuggestionClick: (suggestion: string) => void
}

const suggestions = ['Explore my codebase', 'Write a function', 'Search memories', 'Create a file']

export function MessageList({ messages, onSuggestionClick }: MessageListProps): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)
  const previousMessageCountRef = useRef(0)

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    const isNewMessage = messages.length > previousMessageCountRef.current
    const behavior: ScrollBehavior = isNewMessage || !lastMessage?.isStreaming ? 'smooth' : 'instant'

    bottomRef.current?.scrollIntoView({ behavior })
    previousMessageCountRef.current = messages.length
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto py-4">
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-6 animate-fade-up">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
            <Sparkles className="h-6 w-6 text-accent" />
          </div>
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-text-primary">Welcome to Omni AgentOS</h2>
            <p className="max-w-xs text-sm leading-relaxed text-text-muted">
              Your autonomous AI workspace. Ask anything, build anything.
            </p>
          </div>
          <div className="flex max-w-sm flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="rounded-full border border-border-default bg-bg-surface px-3.5 py-1.5 text-xs text-text-secondary transition-all duration-150 hover:border-accent/30 hover:bg-accent/5 hover:text-accent"
                onClick={() => onSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={bottomRef} className="h-1" />
        </>
      )}
    </div>
  )
}

export default MessageList
