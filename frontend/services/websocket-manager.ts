import type { WSEvent } from '@/types'
import { useUIStore } from '@/store/ui-store'

type EventListener = (event: WSEvent) => void

export class WebSocketManager {
  private ws: WebSocket | null = null
  private sessionId: string
  private listeners: Set<EventListener> = new Set()
  private queue: WSEvent[] = []
  private reconnectDelay: number = 1000
  private readonly maxDelay: number = 30000
  private destroyed: boolean = false
  private reconnectTimeoutId: number | null = null

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  connect(): void {
    if (this.destroyed || this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000'
    const wsUrl = `${wsBaseUrl}/ws/${this.sessionId}`

    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => this.handleOpen()
    this.ws.onmessage = (event) => this.handleMessage(event.data)
    this.ws.onclose = () => this.handleClose()
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  disconnect(): void {
    this.destroyed = true
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(event: WSEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event))
    } else {
      // Queue the event if not connected
      this.queue.push(event)
    }
  }

  on(listener: EventListener): () => void {
    this.listeners.add(listener)
    return () => this.off(listener)
  }

  off(listener: EventListener): void {
    this.listeners.delete(listener)
  }

  private handleOpen(): void {
    console.log('WebSocket connected')
    this.reconnectDelay = 1000 // Reset delay on successful connection
    useUIStore.getState().setWsConnected(true)
    this.flushQueue()
  }

  private handleMessage(raw: string): void {
    try {
      const event = JSON.parse(raw) as WSEvent
      
      // Dispatch to all registered listeners
      this.listeners.forEach((listener) => {
        try {
          listener(event)
        } catch (error) {
          console.error('Error in WebSocket listener:', error)
        }
      })

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  private handleClose(): void {
    console.log('WebSocket disconnected')
    useUIStore.getState().setWsConnected(false)
    this.ws = null

    if (!this.destroyed) {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId)
    }

    console.log(`Reconnecting in ${this.reconnectDelay}ms...`)
    this.reconnectTimeoutId = window.setTimeout(() => {
      this.connect()
      // Exponential backoff with max delay
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay)
    }, this.reconnectDelay)
  }

  private flushQueue(): void {
    while (this.queue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const event = this.queue.shift()
      if (event) {
        this.ws.send(JSON.stringify(event))
      }
    }
  }
}

export const createWebSocketManager = (sessionId: string): WebSocketManager => {
  return new WebSocketManager(sessionId)
}
