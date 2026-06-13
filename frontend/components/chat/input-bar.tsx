'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

export interface InputBarProps {
  onSubmit: (text: string) => void
  disabled?: boolean
}

export function InputBar({ onSubmit, disabled = false }: InputBarProps): JSX.Element {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSubmit(trimmed)
      setValue('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-slate-800 bg-slate-900 p-4">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          className="
            flex-1 resize-none bg-slate-800 text-text-primary placeholder-text-muted
            rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent-blue
            disabled:opacity-50 disabled:cursor-not-allowed
            min-h-[48px] max-h-[200px]
          "
          rows={1}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="
            p-3 rounded-lg bg-accent-blue text-white
            hover:bg-accent-blue/80 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            flex-shrink-0
          "
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

export default InputBar
