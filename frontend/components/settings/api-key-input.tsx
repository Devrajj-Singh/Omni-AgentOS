'use client'

import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Check, Trash2, ShieldCheck } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { updateApiKey, clearApiKey } from '@/services/api'

export function ApiKeyInput(): JSX.Element {
  const { userApiKey, hasUserApiKey, setUserApiKey, clearUserApiKey } = useSettingsStore()
  const [inputValue, setInputValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSave = async (): Promise<void> => {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      setErrorMessage('Please enter an API key.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    try {
      // 1. Update frontend Zustand & sessionStorage
      setUserApiKey(trimmed)
      // 2. Also notify backend settings store
      await updateApiKey(trimmed)

      setInputValue('')
      setSuccessMessage('API key updated for this session.')
      window.setTimeout(() => setSuccessMessage(null), 3000)
    } catch {
      // Even if backend call fails, client-side session key is set and sent via X-API-Key header
      setUserApiKey(trimmed)
      setInputValue('')
      setSuccessMessage('API key saved for session.')
      window.setTimeout(() => setSuccessMessage(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    setIsSaving(true)
    setErrorMessage(null)
    try {
      clearUserApiKey()
      await clearApiKey()
      setSuccessMessage('Reverted to default server key.')
      window.setTimeout(() => setSuccessMessage(null), 3000)
    } catch {
      clearUserApiKey()
      setSuccessMessage('Reverted to default server key.')
      window.setTimeout(() => setSuccessMessage(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const isCustomActive = Boolean(hasUserApiKey || userApiKey)

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className="flex items-center justify-between rounded-lg border border-border-default bg-bg-base p-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              isCustomActive ? 'bg-status-green animate-pulse' : 'bg-text-muted/40'
            }`}
          />
          <div>
            <div className="text-xs font-medium text-text-primary">
              {isCustomActive ? 'Custom BYO Key Active' : 'Default Server Key Active'}
            </div>
            <p className="text-[11px] text-text-muted">
              {isCustomActive
                ? 'Your key overrides server credentials for all agents.'
                : 'Using the system default model credentials.'}
            </p>
          </div>
        </div>

        {isCustomActive && (
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1 text-xs text-text-muted hover:border-status-red/40 hover:text-status-red transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            <span>Remove Key</span>
          </button>
        )}
      </div>

      {/* Input Group */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-text-secondary">
          Enter Model Provider API Key
        </label>
        <div className="relative flex items-center">
          <KeyRound className="absolute left-3 h-4 w-4 text-text-muted" />
          <input
            type={showKey ? 'text' : 'password'}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              if (errorMessage) setErrorMessage(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSave()
              }
            }}
            placeholder={isCustomActive ? '••••••••••••••••••••••••' : 'Enter Groq, OpenAI, or other model key...'}
            disabled={isSaving}
            className="w-full rounded-lg border border-border-default bg-bg-base py-2.5 pl-9 pr-20 text-xs text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none transition-colors"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {inputValue && (
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || !inputValue.trim()}
              className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <p className="text-xs text-status-red">{errorMessage}</p>
      )}
      {successMessage && (
        <p className="flex items-center gap-1 text-xs text-status-green">
          <Check className="h-3.5 w-3.5" />
          <span>{successMessage}</span>
        </p>
      )}

      {/* Security Note */}
      <div className="flex items-start gap-2 rounded-lg border border-border-default/60 bg-bg-surface/50 p-2.5 text-[11px] text-text-muted">
        <ShieldCheck className="h-4 w-4 shrink-0 text-accent/80 mt-0.5" />
        <span>
          <strong>Security:</strong> Stored securely in session storage and transmitted via request headers. Your key is never written to disk, database, or logs.
        </span>
      </div>
    </div>
  )
}
