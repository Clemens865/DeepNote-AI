import { useCallback, useRef, useState } from 'react'
import { GripVertical, Plus, Trash2, RefreshCw, Layout, Type, Columns, Grid3X3, BarChart3, Quote, Flag } from 'lucide-react'
import type { StructuredSlide, PresentationSlideLayout } from '@shared/types'

const LAYOUT_ICONS: Record<PresentationSlideLayout, typeof Layout> = {
  'title-slide': Flag,
  'section-header': Type,
  'content': Layout,
  'two-column': Columns,
  'card-grid': Grid3X3,
  'stat-row': BarChart3,
  'quote': Quote,
  'closing': Flag,
}

interface PresentationSlideNavProps {
  slides: StructuredSlide[]
  selectedSlideId: string | null
  onSelectSlide: (slideId: string) => void
  onReorderSlides: (slideIds: string[]) => void
  onDeleteSlide: (slideId: string) => void
  onRegenSlide: (slideId: string) => void
  onAddSlide: () => void
}

export function PresentationSlideNav({
  slides,
  selectedSlideId,
  onSelectSlide,
  onReorderSlides,
  onDeleteSlide,
  onRegenSlide,
  onAddSlide,
}: PresentationSlideNavProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [contextMenuIdx, setContextMenuIdx] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null)
      setDragOverIdx(null)
      return
    }
    const newOrder = [...slides]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(dropIdx, 0, moved)
    onReorderSlides(newOrder.map(s => s.id))
    setDragIdx(null)
    setDragOverIdx(null)
  }, [dragIdx, slides, onReorderSlides])

  const handleDragEnd = useCallback(() => {
    setDragIdx(null)
    setDragOverIdx(null)
  }, [])

  return (
    <div className="w-[200px] flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] flex flex-col bg-white/50 dark:bg-zinc-900/50">
      <div className="px-3 py-2 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
        Slides ({slides.length})
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
        {slides.map((slide, idx) => {
          const Icon = LAYOUT_ICONS[slide.layout] || Layout
          const isSelected = slide.id === selectedSlideId
          const isDragOver = dragOverIdx === idx

          return (
            <div
              key={slide.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectSlide(slide.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenuIdx(contextMenuIdx === idx ? null : idx)
              }}
              className={`relative group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-left ${
                isDragOver ? 'border-t-2 border-indigo-400' : ''
              } ${
                isSelected
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                  : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <GripVertical size={10} className="opacity-0 group-hover:opacity-40 flex-shrink-0 cursor-grab" />
              <span className="text-[9px] font-mono text-zinc-400 w-3 flex-shrink-0">{idx + 1}</span>
              <Icon size={11} className="flex-shrink-0 opacity-50" />
              <span className="text-[10px] font-medium truncate flex-1">{slide.title}</span>

              {/* Context menu */}
              {contextMenuIdx === idx && (
                <div
                  className="absolute left-full top-0 ml-1 z-20 bg-white dark:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.06] rounded-lg shadow-lg py-1 min-w-[120px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { onRegenSlide(slide.id); setContextMenuIdx(null) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                  >
                    <RefreshCw size={11} /> Regenerate
                  </button>
                  <button
                    onClick={() => { onDeleteSlide(slide.id); setContextMenuIdx(null) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="p-2 border-t border-black/[0.06] dark:border-white/[0.06]">
        <button
          onClick={onAddSlide}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
        >
          <Plus size={11} /> Add Slide
        </button>
      </div>
    </div>
  )
}
