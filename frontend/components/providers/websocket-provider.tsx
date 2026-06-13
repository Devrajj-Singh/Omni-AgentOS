'use client'

import { useEffect } from 'react'
import { useChatStore } from '@/store/chat-store'
import { wsService } from '@/services/websocket'

export function WebSocketProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const sessionId = useChatStore((state) => state.sessionId)

  useEffect(() => {
    if (!sessionId) return

    wsService.connect(sessionId)
    return () => {
      wsService.disconnect()
    }
  }, [sessionId])

  return <>{children}</>
}

export default WebSocketProvider
