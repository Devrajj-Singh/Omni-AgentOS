'use client'

import { useEffect, useRef, useState } from 'react'
import { createWebSocketManager, WebSocketManager } from '@/services/websocket-manager'
import { useUIStore } from '@/store/ui-store'
import type { WSEvent } from '@/types'

export interface UseWebSocketReturn {
  connected: boolean
  events: WSEvent[]
  send: (event: WSEvent) => void
}

export function useWebSocket(sessionId: string | null): UseWebSocketReturn {
  const wsManagerRef = useRef<WebSocketManager | null>(null)
  const [, forceUpdate] = useState({})
  const { wsConnected } = useUIStore()

  useEffect(() => {
    if (!sessionId) {
      return
    }

    // Create WebSocket manager
    const manager = createWebSocketManager(sessionId)
    wsManagerRef.current = manager

    // Register listener to trigger re-renders
    const unsubscribe = manager.on(() => {
      forceUpdate({})
    })

    // Connect
    manager.connect()

    // Cleanup on unmount
    return () => {
      unsubscribe()
      manager.disconnect()
      wsManagerRef.current = null
    }
  }, [sessionId])

  const send = (event: WSEvent) => {
    if (wsManagerRef.current) {
      wsManagerRef.current.send(event)
    }
  }

  return {
    connected: wsConnected,
    events: [],
    send,
  }
}
