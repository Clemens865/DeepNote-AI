import { useEffect, useRef, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Draggable from 'react-draggable'
import type { SlideTextElement } from '@shared/types'
import type { Editor } from '@tiptap/react'

// Custom extension to register fontSize as a TextStyle attribute
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
})

interface DraggableTextElementProps {
  element: SlideTextElement
  isSelected: boolean
  editMode: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
  onSelect: () => void
  onUpdate: (partial: Partial<SlideTextElement>) => void
  onEditorReady?: (editor: Editor) => void
}

export function DraggableTextElement({
  element,
  isSelected,
  editMode,
  containerRef,
  onSelect,
  onUpdate,
  onEditorReady,
}: DraggableTextElementProps) {
  const nodeRef = useRef<HTMLDivElement>(null!)
  const resizingRef = useRef(false)
  const resizeStartRef = useRef({ x: 0, width: 0 })

  // Use refs for callbacks to avoid stale closures in useEditor
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const onEditorReadyRef = useRef(onEditorReady)
  onEditorReadyRef.current = onEditorReady

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      TextAlign.configure({ types: ['paragraph'] }),
      Color,
      TextStyle,
      FontSize,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: element.type === 'title' ? 'Title...' : 'Type here...',
      }),
    ],
    content: element.content,
    editable: editMode,
    onUpdate: ({ editor: ed }) => {
      onUpdateRef.current({ content: ed.getHTML() })
    },
  })

  // Update editable state when editMode changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editMode)
    }
  }, [editor, editMode])

  // Notify parent when editor is ready or selection changes
  useEffect(() => {
    if (editor && isSelected && onEditorReadyRef.current) {
      onEditorReadyRef.current(editor)
    }
  }, [editor, isSelected])

  // Convert percentage position to px for draggable
  const getPixelPosition = useCallback(() => {
    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }
    const rect = container.getBoundingClientRect()
    return {
      x: (element.x / 100) * rect.width,
      y: (element.y / 100) * rect.height,
    }
  }, [element.x, element.y, containerRef])

  const handleDragStop = useCallback(
    (_e: unknown, data: { x: number; y: number }) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const xPct = Math.max(0, Math.min(100, (data.x / rect.width) * 100))
      const yPct = Math.max(0, Math.min(100, (data.y / rect.height) * 100))
      onUpdateRef.current({ x: xPct, y: yPct })
    },
    [containerRef]
  )

  // Resize handler
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      resizingRef.current = true
      const container = containerRef.current
      if (!container) return
      const containerWidth = container.getBoundingClientRect().width
      resizeStartRef.current = {
        x: e.clientX,
        width: (element.width / 100) * containerWidth,
      }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return
        const delta = ev.clientX - resizeStartRef.current.x
        const newWidthPx = Math.max(60, resizeStartRef.current.width + delta)
        const newWidthPct = Math.min(100, Math.max(10, (newWidthPx / containerWidth) * 100))
        onUpdateRef.current({ width: newWidthPct })
      }

      const handleMouseUp = () => {
        resizingRef.current = false
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [containerRef, element.width]
  )

  const pixelPos = getPixelPosition()
  const container = containerRef.current
  const widthPx = container ? (element.width / 100) * container.getBoundingClientRect().width : 200

  // Font size class based on element type
  const fontSizeStyle = element.style.fontSize ? `${element.style.fontSize}px` : element.type === 'title' ? '20px' : '14px'

  if (!editMode) {
    // Static render — no drag, no editor chrome
    return (
      <div
        className="absolute"
        style={{
          left: `${element.x}%`,
          top: `${element.y}%`,
          width: `${element.width}%`,
          fontSize: fontSizeStyle,
          color: element.style.color || 'inherit',
          textAlign: element.style.align || 'left',
          fontWeight: element.type === 'title' ? 700 : 400,
        }}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(element.content) }}
      />
    )
  }

  return (
    <Draggable
      nodeRef={nodeRef as React.RefObject<HTMLElement>}
      bounds="parent"
      position={pixelPos}
      onStop={handleDragStop}
      handle=".drag-handle"
      disabled={!editMode}
    >
      <div
        ref={nodeRef}
        className={`absolute group ${isSelected ? 'z-20' : 'z-10'}`}
        style={{ top: 0, left: 0, width: widthPx }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        {/* Selection ring */}
        <div
          className={`relative rounded-lg transition-shadow ${
            isSelected
              ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20'
              : 'hover:ring-1 hover:ring-indigo-400/40'
          }`}
        >
          {/* Drag handle (top bar) */}
          <div className="drag-handle absolute -top-5 left-0 right-0 h-5 flex items-center justify-center cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-zinc-400" />
              <span className="w-1 h-1 rounded-full bg-zinc-400" />
              <span className="w-1 h-1 rounded-full bg-zinc-400" />
              <span className="w-1 h-1 rounded-full bg-zinc-400" />
              <span className="w-1 h-1 rounded-full bg-zinc-400" />
            </div>
          </div>

          {/* Tiptap editor */}
          <div
            style={{
              fontSize: fontSizeStyle,
              color: element.style.color || 'inherit',
              textAlign: element.style.align || 'left',
              fontWeight: element.type === 'title' ? 700 : 400,
            }}
          >
            <EditorContent editor={editor} />
          </div>

          {/* Resize handle (bottom-right corner) */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-indigo-500 rounded-full cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={handleResizeMouseDown}
          />
        </div>
      </div>
    </Draggable>
  )
}
