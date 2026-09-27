'use client'

import { useCallback, useEffect, useRef } from 'react'
import type React from 'react'
import { useUIStore } from '@/store/ui-store'

const MIN_HEIGHT = 100
const MAX_HEIGHT_RATIO = 0.55

export function useResize() {
  const { setTerminalPanelHeight, setIsResizingTerminal } = useUIStore()
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    startYRef.current = e.clientY
    startHeightRef.current = useUIStore.getState().terminalPanelHeight
    setIsResizingTerminal(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
  }, [setIsResizingTerminal])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }

      rafRef.current = requestAnimationFrame(() => {
        const deltaY = startYRef.current - e.clientY
        const newHeight = startHeightRef.current + deltaY

        const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO
        const clampedHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, maxHeight))

        setTerminalPanelHeight(clampedHeight)
      })
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsResizingTerminal(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [setTerminalPanelHeight, setIsResizingTerminal])

  return { handleMouseDown }
}
