'use client'

import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Loader2, Send } from 'lucide-react'
import { AutonomousToggle } from './autonomous-toggle'

export interface ChatInputProps {
  onSend: (content: string) => void
  disabled: boolean
  value: string
  onValueChange: (value: string) => void
  contextLabel?: string
}

export function ChatInput({ onSend, disabled, value, onValueChange, contextLabel }: ChatInputProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previousDisabledRef = useRef(disabled)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`
  }, [value])

  useEffect(() => {
    if (previousDisabledRef.current && !disabled) {
      textareaRef.current?.focus()
    }
    previousDisabledRef.current = disabled
  }, [disabled])

  const submit = (): void => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    onValueChange('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="rounded-xl border border-border-default bg-bg-surface transition-colors duration-150 focus-within:border-accent">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask Omni AgentOS..."
          rows={1}
          className="max-h-[220px] min-h-[48px] w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
        />
        <div className="flex flex-col gap-2 px-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 pr-3 text-xs text-text-muted">
            <AutonomousToggle />
            {contextLabel ? (
              <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border-default bg-bg-base px-2 py-1">
                <span className="truncate">{contextLabel}</span>
              </span>
            ) : (
              <span>{disabled ? 'Generating...' : 'Shift+Enter for newline'}</span>
            )}
          </div>
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="btn-primary flex shrink-0 items-center justify-center gap-1.5 px-4 py-1.5 text-xs sm:justify-start"
            aria-label="Send message"
          >
            {disabled ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            <span>Send</span>
          </button>
        </div>
      </div>
    </form>
  )
}

export default ChatInput
