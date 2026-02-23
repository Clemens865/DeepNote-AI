import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, StickyNote, Download, Maximize2, X, Pencil, FileDown, Check, Loader2, Save } from 'lucide-react'
import type { ImageSlidesGeneratedData, ImageSlideData, HybridSlideData, SlideTextElement } from '@shared/types'
import { DraggableTextElement } from './DraggableTextElement'
import { SlideEditorToolbar } from './SlideEditorToolbar'
import type { Editor } from '@tiptap/react'

// Color palettes: [overlay-bg, title-color, accent-color, body-text-color]
const PALETTE_MAP: Record<string, [string, string, string, string]> = {
  'neon-circuit': ['#0a0a14', '#a855f7', '#22d3ee', '#e2e8f0'],
  'glass-morph': ['#0f172a', '#e2e8f0', '#818cf8', '#94a3b8'],
  'gradient-mesh': ['#0c1222', '#ec4899', '#3b82f6', '#e2e8f0'],
  'terminal-hacker': ['#0a0f0a', '#22c55e', '#4ade80', '#d1fae5'],
  'cosmic-dark': ['#06060e', '#8b5cf6', '#f43f5e', '#e2e8f0'],
  'arctic-frost': ['#0f1729', '#38bdf8', '#f8fafc', '#64748b'],
}

let nextElementId = 1
function genId(): string {
  return `el-${Date.now()}-${nextElementId++}`
}

/** Convert legacy title+bullets into SlideTextElement[] — uses AI elementLayout when available */
function migrateToElements(
  slide: HybridSlideData,
  style: string
): SlideTextElement[] {
  const palette = PALETTE_MAP[style] || PALETTE_MAP['blueprint-dark']
  const [, titleColor, accentColor, bodyColor] = palette

  // If AI-generated layout is available, use it
  if (slide.elementLayout && slide.elementLayout.length > 0) {
    const elements: SlideTextElement[] = []
    for (const layout of slide.elementLayout) {
      const color = layout.type === 'title' ? titleColor : bodyColor
      elements.push({
        id: genId(),
        type: layout.type as 'title' | 'bullet' | 'text',
        content: `<p>${layout.content}</p>`,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        style: {
          fontSize: layout.fontSize,
          color,
          align: layout.align,
        },
      })
    }
    return elements
  }

  // Fallback: hardcoded split-screen layout for legacy data
  const xStart = 4
  const widthPct = 42

  const elements: SlideTextElement[] = []

  elements.push({
    id: genId(),
    type: 'title',
    content: `<p>${slide.title}</p>`,
    x: xStart,
    y: 12,
    width: widthPct,
    style: { fontSize: 22, color: titleColor, align: 'left' },
  })

  elements.push({
    id: genId(),
    type: 'text',
    content: `<p>---</p>`,
    x: xStart,
    y: 22,
    width: 12,
    style: { fontSize: 10, color: accentColor, align: 'left' },
  })

  slide.bullets.forEach((bullet, i) => {
    elements.push({
      id: genId(),
      type: 'bullet',
      content: `<p>${bullet}</p>`,
      x: xStart,
      y: 28 + i * 12,
      width: widthPct,
      style: { fontSize: 14, color: bodyColor, align: 'left' },
    })
  })

  return elements
}

interface HybridSlideProps {
  slide: HybridSlideData
  style: string
  aspectRatio: string
  contentId: string
  customPalette?: string[]
  onClick?: () => void
}

function HybridSlide({ slide, style, aspectRatio, contentId, customPalette, onClick }: HybridSlideProps) {
  const palette: [string, string, string, string] = customPalette && customPalette.length >= 4
    ? [customPalette[0], customPalette[1], customPalette[2], customPalette[3]]
    : PALETTE_MAP[style] || PALETTE_MAP['neon-circuit']
  const [overlayBg] = palette
  const isDarkOverlay = overlayBg.startsWith('#0') || overlayBg.startsWith('#1') || overlayBg === '#0c0c0c'
  const isTitleSlide = slide.slideNumber === 1

  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestElementsRef = useRef<SlideTextElement[]>([])

  const [editMode, setEditMode] = useState(false)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize elements: use existing or migrate from title+bullets
  const [elements, setElements] = useState<SlideTextElement[]>(() => {
    const initial = (slide.elements && slide.elements.length > 0)
      ? slide.elements
      : migrateToElements(slide, style)
    latestElementsRef.current = initial
    return initial
  })

  // Re-initialize if the slide changes (e.g., navigating to a different slide)
  const slideKey = `${slide.slideNumber}-${slide.imagePath}`
  const prevSlideKeyRef = useRef(slideKey)
  useEffect(() => {
    if (prevSlideKeyRef.current !== slideKey) {
      prevSlideKeyRef.current = slideKey
      const next = (slide.elements && slide.elements.length > 0)
        ? slide.elements
        : migrateToElements(slide, style)
      setElements(next)
      latestElementsRef.current = next
      setSelectedElementId(null)
      setActiveEditor(null)
      setEditMode(false)
    }
  }, [slideKey, slide, style])

  // Immediate save function (no debounce)
  const saveNow = useCallback(
    (els: SlideTextElement[], showFeedback = false) => {
      const titleEl = els.find((e) => e.type === 'title')
      const bulletEls = els.filter((e) => e.type === 'bullet')
      const title = titleEl
        ? titleEl.content.replace(/<[^>]*>/g, '')
        : slide.title
      const bullets = bulletEls.length > 0
        ? bulletEls.map((b) => b.content.replace(/<[^>]*>/g, ''))
        : slide.bullets

      if (showFeedback) setSaveStatus('saving')

      window.api.imageSlidesUpdateText({
        generatedContentId: contentId,
        slideNumber: slide.slideNumber,
        title,
        bullets,
        elements: els,
      }).then(() => {
        if (showFeedback) {
          setSaveStatus('saved')
          if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
          saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1500)
        }
      }).catch(() => {
        if (showFeedback) setSaveStatus('idle')
      })
    },
    [contentId, slide.slideNumber, slide.title, slide.bullets]
  )

  // Debounced save to backend
  const saveElements = useCallback(
    (updatedElements: SlideTextElement[]) => {
      latestElementsRef.current = updatedElements
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        saveNow(updatedElements)
        debounceRef.current = null
      }, 800)
    },
    [saveNow]
  )

  // Flush pending save immediately (used when exiting edit mode or clicking Save)
  const flushSave = useCallback((showFeedback = false) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    saveNow(latestElementsRef.current, showFeedback)
  }, [saveNow])

  const handleElementUpdate = useCallback(
    (elementId: string, partial: Partial<SlideTextElement>) => {
      setElements((prev) => {
        const next = prev.map((el) =>
          el.id === elementId ? { ...el, ...partial } : el
        )
        saveElements(next)
        return next
      })
    },
    [saveElements]
  )

  const handleAddElement = useCallback(() => {
    const newEl: SlideTextElement = {
      id: genId(),
      type: 'text',
      content: '<p>New text</p>',
      x: 30,
      y: 40,
      width: 40,
      style: {
        fontSize: 16,
        color: isDarkOverlay ? '#e2e8f0' : '#18181b',
        align: 'left',
      },
    }
    setElements((prev) => {
      const next = [...prev, newEl]
      saveElements(next)
      return next
    })
    setSelectedElementId(newEl.id)
  }, [isDarkOverlay, saveElements])

  const handleDeleteElement = useCallback(() => {
    if (!selectedElementId || elements.length <= 1) return
    setElements((prev) => {
      const next = prev.filter((el) => el.id !== selectedElementId)
      saveElements(next)
      return next
    })
    setSelectedElementId(null)
    setActiveEditor(null)
  }, [selectedElementId, elements.length, saveElements])

  const handleBackgroundClick = useCallback(() => {
    if (editMode) {
      setSelectedElementId(null)
      setActiveEditor(null)
    } else {
      onClick?.()
    }
  }, [editMode, onClick])

  // Title slide (slide 1): render as full-image, no text overlays
  if (isTitleSlide && !editMode) {
    return (
      <div
        className="relative overflow-hidden rounded-lg cursor-pointer"
        style={{ aspectRatio: aspectRatio === '4:3' ? '4/3' : '16/9' }}
        onClick={onClick}
      >
        <img
          src={`local-file://${slide.imagePath}`}
          alt={slide.title}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Toolbar (positioned above slide) */}
      {editMode && selectedElementId && (
        <div className="flex justify-center mb-2">
          <SlideEditorToolbar
            editor={activeEditor}
            onAddElement={handleAddElement}
            onDeleteElement={handleDeleteElement}
            canDelete={elements.length > 1}
          />
        </div>
      )}

      <div
        ref={containerRef}
        className={`relative rounded-lg ${editMode ? 'overflow-visible' : 'overflow-hidden'}`}
        style={{ aspectRatio: aspectRatio === '4:3' ? '4/3' : '16/9' }}
        onClick={handleBackgroundClick}
      >
        {/* Background image — own clipping for rounded corners */}
        <img
          src={`local-file://${slide.imagePath}`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover rounded-lg"
        />

        {/* Split-screen overlay: solid left panel for text readability */}
        <div
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{
            background: isDarkOverlay
              ? `linear-gradient(to right, ${overlayBg}e6 0%, ${overlayBg}cc 42%, ${overlayBg}40 52%, transparent 62%)`
              : `linear-gradient(to right, ${overlayBg}f0 0%, ${overlayBg}dd 42%, ${overlayBg}60 52%, transparent 62%)`,
          }}
        />

        {/* Accent bar — thin vertical line at the split boundary */}
        {!editMode && (
          <div
            className="absolute pointer-events-none rounded-lg"
            style={{
              left: '47%',
              top: '8%',
              bottom: '8%',
              width: '2px',
              backgroundColor: palette[2] + '60',
            }}
          />
        )}

        {/* Elements */}
        {elements.map((el) => (
          <DraggableTextElement
            key={el.id}
            element={el}
            isSelected={selectedElementId === el.id}
            editMode={editMode}
            containerRef={containerRef}
            onSelect={() => setSelectedElementId(el.id)}
            onUpdate={(partial) => handleElementUpdate(el.id, partial)}
            onEditorReady={setActiveEditor}
          />
        ))}

        {/* Save button (visible in edit mode) */}
        {editMode && (
          <button
            className={`absolute top-2 right-12 z-30 h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${
              saveStatus === 'saved'
                ? 'bg-emerald-500/90 text-white'
                : saveStatus === 'saving'
                  ? 'bg-indigo-500/70 text-white/80'
                  : 'bg-black/40 text-white/70 hover:bg-black/60 hover:text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation()
              flushSave(true)
            }}
            title="Save changes"
          >
            {saveStatus === 'saving' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check size={12} />
            ) : (
              <Save size={12} />
            )}
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? '' : 'Save'}
          </button>
        )}

        {/* Edit mode toggle button */}
        <button
          className={`absolute top-2 right-2 z-30 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            editMode
              ? 'bg-indigo-500 text-white shadow-lg'
              : 'bg-black/40 text-white/70 hover:bg-black/60 hover:text-white'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            if (editMode) {
              flushSave()
              setSelectedElementId(null)
              setActiveEditor(null)
            }
            setEditMode(!editMode)
          }}
          title={editMode ? 'Exit edit mode' : 'Edit slide'}
        >
          <Pencil size={14} />
        </button>
      </div>
    </div>
  )
}

interface ImageSlidesViewProps {
  data: Record<string, unknown>
  contentId?: string
}

export function ImageSlidesView({ data, contentId }: ImageSlidesViewProps) {
  const slidesData = data as unknown as ImageSlidesGeneratedData
  const renderMode = slidesData.renderMode || 'full-image'
  const isHybrid = renderMode === 'hybrid'
  const slides = isHybrid ? (slidesData.hybridSlides || []) : (slidesData.slides || [])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const goNext = useCallback(() => {
    setCurrentSlide((s) => Math.min(slides.length - 1, s + 1))
  }, [slides.length])

  const goPrev = useCallback(() => {
    setCurrentSlide((s) => Math.max(0, s - 1))
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault()
        setIsFullscreen(false)
        return
      }

      // Don't intercept keys when user is editing text (Tiptap, input, textarea)
      const active = document.activeElement
      const isEditing =
        active?.closest('[contenteditable="true"]') ||
        active?.tagName === 'INPUT' ||
        active?.tagName === 'TEXTAREA'
      if (isEditing) return

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev, isFullscreen])

  if (slides.length === 0) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
        No slides generated yet.
      </p>
    )
  }

  const slide = slides[currentSlide]
  const imagePath = isHybrid ? (slide as HybridSlideData).imagePath : (slide as ImageSlideData).imagePath

  return (
    <>
      <div className="space-y-3">
        {/* Main slide */}
        {isHybrid ? (
          <HybridSlide
            slide={slide as HybridSlideData}
            style={slidesData.style}
            aspectRatio={slidesData.aspectRatio}
            contentId={contentId || ''}
            customPalette={slidesData.customPalette}
            onClick={() => setIsFullscreen(true)}
          />
        ) : (
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: slidesData.aspectRatio === '4:3' ? '4/3' : '16/9' }}>
            <img
              src={`local-file://${imagePath}`}
              alt={(slide as ImageSlideData).title}
              className="w-full h-full object-contain cursor-pointer"
              onClick={() => setIsFullscreen(true)}
            />
          </div>
        )}

        {/* Prev/Next overlays (for both modes) */}
        <div className="relative -mt-3">
          <div className="absolute -top-16 left-2 right-2 flex justify-between pointer-events-none">
            {currentSlide > 0 && (
              <button
                onClick={goPrev}
                className="pointer-events-auto w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="flex-1" />
            {currentSlide < slides.length - 1 && (
              <button
                onClick={goNext}
                className="pointer-events-auto w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Controls row: expand + counter + download */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              className="w-7 h-7 rounded-md bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] flex items-center justify-center text-zinc-500 dark:text-zinc-400 transition-colors"
              title="Fullscreen"
            >
              <Maximize2 size={14} />
            </button>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {currentSlide + 1} / {slides.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const allPaths = slides.map((s) =>
                  isHybrid ? (s as HybridSlideData).imagePath : (s as ImageSlideData).imagePath
                )
                const textOverlays = isHybrid
                  ? slides.map((s) => {
                      const hs = s as HybridSlideData
                      const els = hs.elements || []
                      return {
                        elements: els.map((el) => ({
                          content: el.content.replace(/<[^>]*>/g, ''),
                          x: el.x,
                          y: el.y,
                          width: el.width,
                          fontSize: el.style?.fontSize || 16,
                          align: el.style?.align || 'left',
                          color: el.style?.color,
                          bold: el.type === 'title',
                        })),
                      }
                    })
                  : undefined
                window.api.studioExportPdf({
                  imagePaths: allPaths,
                  aspectRatio: (slidesData.aspectRatio === '4:3' ? '4:3' : '16:9') as '16:9' | '4:3',
                  defaultName: 'slide-deck.pdf',
                  textOverlays,
                })
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <FileDown size={12} />
              PDF
            </button>
            <button
              onClick={() => window.api.studioSaveFile({ sourcePath: imagePath, defaultName: `slide-${currentSlide + 1}.png` })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <Download size={12} />
              Slide
            </button>
          </div>
        </div>

        {/* Thumbnail strip */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {slides.map((s, i) => {
            const thumbPath = isHybrid ? (s as HybridSlideData).imagePath : (s as ImageSlideData).imagePath
            return (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`flex-shrink-0 w-16 h-9 rounded border-2 overflow-hidden transition-colors ${
                  i === currentSlide
                    ? 'border-indigo-500'
                    : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <img
                  src={`local-file://${thumbPath}`}
                  alt={`Slide ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            )
          })}
        </div>

        {/* Speaker notes toggle */}
        {slide.speakerNotes && (
          <div>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <StickyNote size={12} />
              {showNotes ? 'Hide' : 'Show'} speaker notes
            </button>
            {showNotes && (
              <div className="mt-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3">
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {slide.speakerNotes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen overlay — portaled to body to escape backdrop-blur containing block */}
      {isFullscreen && createPortal(
        <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-zinc-900/80 border-b border-zinc-800">
            <div className="flex items-center gap-3 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{slide.title}</h3>
              <span className="text-xs text-zinc-400 flex-shrink-0">
                {currentSlide + 1} of {slides.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.api.studioSaveFile({ sourcePath: imagePath, defaultName: `slide-${currentSlide + 1}.png` })}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Download slide"
              >
                <Download size={16} />
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Close fullscreen"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body: slide + thumbnail strip */}
          <div className="flex flex-1 min-h-0">
            {/* Main slide area */}
            <div className="flex-1 relative flex items-center justify-center p-6">
              {isHybrid ? (
                <div className="max-w-full max-h-full w-full h-full flex items-center justify-center">
                  <div className="w-full max-w-5xl">
                    <HybridSlide
                      slide={slide as HybridSlideData}
                      style={slidesData.style}
                      aspectRatio={slidesData.aspectRatio}
                      contentId={contentId || ''}
                      customPalette={slidesData.customPalette}
                    />
                  </div>
                </div>
              ) : (
                <img
                  src={`local-file://${imagePath}`}
                  alt={slide.title}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              )}

              {/* Prev/Next nav */}
              {currentSlide > 0 && (
                <button
                  onClick={goPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-zinc-800/70 hover:bg-zinc-700 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              {currentSlide < slides.length - 1 && (
                <button
                  onClick={goNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-zinc-800/70 hover:bg-zinc-700 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronRight size={22} />
                </button>
              )}
            </div>

            {/* Thumbnail sidebar */}
            <div className="w-32 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto py-3 px-2 flex flex-col gap-2">
              {slides.map((s, i) => {
                const thumbPath = isHybrid ? (s as HybridSlideData).imagePath : (s as ImageSlideData).imagePath
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      i === currentSlide
                        ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                        : 'border-transparent hover:border-zinc-600'
                    }`}
                  >
                    <img
                      src={`local-file://${thumbPath}`}
                      alt={`Slide ${i + 1}`}
                      className="w-full aspect-video object-cover"
                    />
                    <span className={`absolute bottom-0.5 right-1 text-[10px] font-medium ${
                      i === currentSlide ? 'text-indigo-300' : 'text-zinc-500'
                    }`}>
                      {i + 1}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Speaker notes bar (if notes exist) */}
          {slide.speakerNotes && (
            <div className="px-5 py-3 bg-zinc-900/80 border-t border-zinc-800">
              <div className="flex items-start gap-2">
                <StickyNote size={12} className="text-zinc-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                  {slide.speakerNotes}
                </p>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
