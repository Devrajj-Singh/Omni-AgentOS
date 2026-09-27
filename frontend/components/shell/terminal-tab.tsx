'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useDeveloperStore } from '@/store/developer-store'

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000')
  .replace(/^http/, 'ws')

const RESIZE_PREFIX = '__RESIZE__:'

export function TerminalTab(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<import('@xterm/xterm').Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
  const workspacePath = useDeveloperStore((s) => s.workspace.rootPath)

  const connect = useCallback(() => {
    if (!containerRef.current) return
    setStatus('connecting')

    // Clean up previous instances
    resizeObserverRef.current?.disconnect()
    xtermRef.current?.dispose()
    wsRef.current?.close()

    // Lazy import to avoid SSR issues
    Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/addon-web-links'),
    ]).then(([{ Terminal }, { FitAddon }, { WebLinksAddon }]) => {
      const term = new Terminal({
        theme: {
          background: '#0a0a0f',
          foreground: '#e2e8f0',
          cursor: '#818cf8',
          selectionBackground: '#374151',
        },
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        cursorBlink: true,
        scrollback: 3000,
      })

      const fit = new FitAddon()
      const links = new WebLinksAddon()
      term.loadAddon(fit)
      term.loadAddon(links)

      if (containerRef.current) {
        term.open(containerRef.current)
        try {
          fit.fit()
        } catch {
          // ignore layout measurement if container is zero-sized initially
        }
      }

      xtermRef.current = term
      fitRef.current = fit

      // Connect WebSocket
      const params = workspacePath
        ? `?workspace_root=${encodeURIComponent(workspacePath)}`
        : ''
      const ws = new WebSocket(`${WS_BASE}/ws/terminal${params}`)
      wsRef.current = ws

      const syncDimensions = () => {
        if (!containerRef.current || !fitRef.current || !xtermRef.current) return
        try {
          fitRef.current.fit()
          if (ws.readyState === WebSocket.OPEN) {
            const dims = { cols: xtermRef.current.cols, rows: xtermRef.current.rows }
            ws.send(`${RESIZE_PREFIX}${JSON.stringify(dims)}`)
          }
        } catch {
          // container might be hidden or 0-size
        }
      }

      ws.onopen = () => {
        setStatus('connected')
        syncDimensions()
      }

      ws.onmessage = (e) => {
        term.write(e.data as string)
      }

      ws.onclose = () => {
        setStatus('disconnected')
      }

      ws.onerror = () => {
        setStatus('error')
      }

      // User input → backend
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data)
      })

      // ResizeObserver to track container resizing (tab switches, bottom panel resizing)
      const observer = new ResizeObserver(() => {
        syncDimensions()
      })
      if (containerRef.current) {
        observer.observe(containerRef.current)
      }
      resizeObserverRef.current = observer

      // Window resize fallback
      const handleResize = () => {
        syncDimensions()
      }
      window.addEventListener('resize', handleResize)

      ;(term as unknown as { _resizeHandler: () => void })._resizeHandler = handleResize
    })
  }, [workspacePath])

  useEffect(() => {
    connect()
    return () => {
      resizeObserverRef.current?.disconnect()
      const term = xtermRef.current
      if (term) {
        const handler = (term as unknown as { _resizeHandler?: () => void })._resizeHandler
        if (handler) window.removeEventListener('resize', handler)
        term.dispose()
      }
      wsRef.current?.close()
    }
  }, [connect])

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border-default px-3 py-1">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-500'
                  : status === 'connecting'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-text-muted capitalize">{status}</span>
          </span>
          <span className="text-xs text-text-muted font-mono">
            {workspacePath ? workspacePath : 'Terminal (~)'}
          </span>
        </div>
        <button
          onClick={connect}
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
          title="Reconnect terminal"
        >
          ↻ reconnect
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden p-1" />
    </div>
  )
}
