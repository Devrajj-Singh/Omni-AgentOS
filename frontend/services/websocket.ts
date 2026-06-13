import { useUiStore } from '@/store/ui-store'
import type { WSEvent, WSEventType } from '@/types'

type WSEventHandler = (event: WSEvent) => void

class WebSocketService {
  private ws: WebSocket | null = null
  private listeners: Map<WSEventType, Set<WSEventHandler>> = new Map()
  private reconnectAttempts = 0
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private sessionId: string | null = null
  private isUnloading = false
  private manuallyDisconnected = false

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.isUnloading = true
      })
    }
  }

  connect(sessionId: string): void {
    if (typeof window === 'undefined' || !sessionId) return

    if (
      this.sessionId === sessionId &&
      (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    this.disconnect()
    this.sessionId = sessionId
    this.manuallyDisconnected = false

    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000'
    this.ws = new WebSocket(`${wsBaseUrl}/ws/${sessionId}`)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      useUiStore.getState().setWsConnected(true)
      console.log('WebSocket connected')
    }

    this.ws.onclose = () => {
      this.ws = null
      useUiStore.getState().setWsConnected(false)
      this.reconnect()
    }

    this.ws.onerror = (event: Event) => {
      console.error('WebSocket error:', event)
    }

    this.ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const wsEvent = JSON.parse(event.data) as WSEvent
        this.dispatch(wsEvent)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }
  }

  disconnect(): void {
    this.manuallyDisconnected = true

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    useUiStore.getState().setWsConnected(false)
  }

  on(type: WSEventType, handler: WSEventHandler): () => void {
    const handlers = this.listeners.get(type) ?? new Set<WSEventHandler>()
    handlers.add(handler)
    this.listeners.set(type, handlers)

    return () => {
      const currentHandlers = this.listeners.get(type)
      currentHandlers?.delete(handler)
      if (currentHandlers?.size === 0) {
        this.listeners.delete(type)
      }
    }
  }

  private dispatch(event: WSEvent): void {
    const handlers = this.listeners.get(event.type)
    handlers?.forEach((handler) => {
      try {
        handler(event)
      } catch (error) {
        console.error('Error in WebSocket listener:', error)
      }
    })
  }

  private reconnect(): void {
    if (this.isUnloading || this.manuallyDisconnected || !this.sessionId) return

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000)
    console.log(`WebSocket disconnected. Reconnecting in ${delay}ms...`)

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts += 1
      if (this.sessionId) {
        this.connect(this.sessionId)
      }
    }, delay)
  }
}

export const wsService = new WebSocketService()
