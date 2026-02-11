import { type ReactNode, useRef, useCallback, useState } from 'react'

interface ResizablePanelProps {
  children: ReactNode
  defaultWidth: number
  minWidth: number
  maxWidth: number
  side: 'left' | 'right'
  collapsed: boolean
  collapsedWidth?: number
}

export function ResizablePanel({
  children,
  defaultWidth,
  minWidth,
  maxWidth,
  side,
  collapsed,
  collapsedWidth = 48,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth)
  const isResizing = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isResizing.current = true

      const startX = e.clientX
      const startWidth = width

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return
        const delta = side === 'left'
          ? moveEvent.clientX - startX
          : startX - moveEvent.clientX
        const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta))
        setWidth(newWidth)
      }

      const handleMouseUp = () => {
        isResizing.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [width, minWidth, maxWidth, side]
  )

  const currentWidth = collapsed ? collapsedWidth : width

  return (
    <div className="relative shrink-0 flex" style={{ width: currentWidth }}>
      <div className="flex-1 overflow-hidden">{children}</div>
      {!collapsed && (
        <div
          className={`absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-10 ${
            side === 'left' ? 'right-0' : 'left-0'
          }`}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  )
}
