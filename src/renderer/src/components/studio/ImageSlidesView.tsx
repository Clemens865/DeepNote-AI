import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, StickyNote, Download, Maximize2, X, Pencil } from 'lucide-react'
import type { ImageSlidesGeneratedData, ImageSlideData, HybridSlideData, SlideTextElement } from '@shared/types'
import { DraggableTextElement } from './DraggableTextElement'
import { SlideEditorToolbar } from './SlideEditorToolbar'
import type { Editor } from '@tiptap/react'

// Color palettes: [overlay-bg, title-color, accent-color, body-text-color]
const PALETTE_MAP: Record<string, [string, string, string, string]> = {
  'blueprint-dark': ['#0f2b3c', '#f97316', '#06b6d4', '#e2e8f0'],
  'editorial-clean': ['#faf5eb', '#ea580c', '#1e5fa6', '#18181b'],
  'corporate-blue': ['#ffffff', '#1e3a5f', '#3b82f6', '#64748b'],
  'bold-minimal': ['#ffffff', '#18181b', '#dc2626', '#71717a'],
  'nature-warm': ['#fef9ef', '#2d5016', '#c2410c', '#d4a76a'],
  'dark-luxe': ['#0c0c0c', '#c9a84c', '#ffffff', '#2a2a2a'],
}

let nextElementId = 1
function genId(): string {
  return `el-${Date.now()}-${nextElementId++}`
}

/** Convert legacy title+bullets into SlideTextElement[] based on layout & palette */
function migrateToElements(
  slide: HybridSlideData,
  style: string
): SlideTextElement[] {
  const palette = PALETTE_MAP[style] || PALETTE_MAP['blueprint-dark']
  const [, titleColor, , bodyColor] = palette
  const layout = slide.layout.toLowerCase()

  // Compute starting positions based on layout
  let xStart = 10
  let yStart = 12
  let widthPct = 40

  if (layout.includes('left')) {
    xStart = 5; yStart = 10; widthPct = 42
  } else if (layout.includes('right')) {
    xStart = 52; yStart = 10; widthPct = 42
  } else if (layout.includes('bottom')) {
    xStart = 5; yStart = 55; widthPct = 90
  } else {
    xStart = 10; yStart = 10; widthPct = 80
  }

  const elements: SlideTextElement[] = []

  // Title element
  elements.push({
    id: genId(),
    type: 'title',
    content: `<p>${slide.title}</p>`,
    x: xStart,
    y: yStart,
    width: widthPct,
    style: { fontSize: 20, color: titleColor, align: 'left' },
  })

  // Bullet elements — stacked below title
  slide.bullets.forEach((bullet, i) => {
    elements.push({
      id: genId(),
      type: 'bullet',
      content: `<p>${bullet}</p>`,
      x: xStart,
      y: yStart + 10 + i * 8,
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
  onClick?: () => void
}

function HybridSlide({ slide, style, aspectRatio, contentId, onClick }: HybridSlideProps) {
  const palette = PALETTE_MAP[style] || PALETTE_MAP['blueprint-dark']
  const [overlayBg] = palette
  const isDarkOverlay = overlayBg.startsWith('#0') || overlayBg.startsWith('#1') || overlayBg === '#0c0c0c'

  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null)

  // Initialize elements: use existing or migrate from title+bullets
  const [elements, setElements] = useState<SlideTextElement[]>(() => {
    if (slide.elements && slide.elements.length > 0) {
      return slide.elements
    }
    return migrateToElements(slide, style)
  })

  // Re-initialize if the slide changes (e.g., navigating to a different slide)
  const slideKey = `${slide.slideNumber}-${slide.imagePath}`
  const prevSlideKeyRef = useRef(slideKey)
  useEffect(() => {
    if (prevSlideKeyRef.current !== slideKey) {
      prevSlideKeyRef.current = slideKey
      if (slide.elements && slide.elements.length > 0) {
        setElements(slide.elements)
      } else {
        setElements(migrateToElements(slide, style))
      }
      setSelectedElementId(null)
      setActiveEditor(null)
      setEditMode(false)
    }
  }, [slideKey, slide, style])

  // Debounced save to backend
  const saveElements = useCallback(
    (updatedElements: SlideTextElement[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        // Extract title and bullets for backward compat
        const titleEl = updatedElements.find((e) => e.type === 'title')
        const bulletEls = updatedElements.filter((e) => e.type === 'bullet')
        const title = titleEl
          ? titleEl.content.replace(/<[^>]*>/g, '')
          : slide.title
        const bullets = bulletEls.length > 0
          ? bulletEls.map((b) => b.content.replace(/<[^>]*>/g, ''))
          : slide.bullets

        window.api.imageSlidesUpdateText({
          generatedContentId: contentId,
          slideNumber: slide.slideNumber,
          title,
          bullets,
          elements: updatedElements,
        })
      }, 800)
    },
    [contentId, slide.slideNumber, slide.title, slide.bullets]
  )

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
        className="relative overflow-hidden rounded-lg"
        style={{ aspectRatio: aspectRatio === '4:3' ? '4/3' : '16/9' }}
        onClick={handleBackgroundClick}
      >
        {/* Background image */}
        <img
          src={`local-file://${slide.imagePath}`}
          alt=""
          className="w-full h-full object-cover"
        />

        {/* Semi-transparent overlay for text readability */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isDarkOverlay
              ? `linear-gradient(135deg, ${overlayBg}99 0%, transparent 60%)`
              : `linear-gradient(135deg, ${overlayBg}cc 0%, transparent 60%)`,
          }}
        />

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

        {/* Edit mode toggle button */}
        <button
          className={`absolute top-2 right-2 z-30 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            editMode
              ? 'bg-indigo-500 text-white shadow-lg'
              : 'bg-black/40 text-white/70 hover:bg-black/60 hover:text-white'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            setEditMode(!editMode)
            if (editMode) {
              setSelectedElementId(null)
              setActiveEditor(null)
            }
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
      <p className="text-sm text-slate-400 dark:text-slate-500 italic">
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
              className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
              title="Fullscreen"
            >
              <Maximize2 size={14} />
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {currentSlide + 1} / {slides.length}
            </span>
          </div>
          <button
            onClick={() => window.api.studioSaveFile({ sourcePath: imagePath, defaultName: `slide-${currentSlide + 1}.png` })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Download size={12} />
            Download slide
          </button>
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
                    : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
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
              className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <StickyNote size={12} />
              {showNotes ? 'Hide' : 'Show'} speaker notes
            </button>
            {showNotes && (
              <div className="mt-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {slide.speakerNotes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900/80 border-b border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{slide.title}</h3>
              <span className="text-xs text-slate-400 flex-shrink-0">
                {currentSlide + 1} of {slides.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.api.studioSaveFile({ sourcePath: imagePath, defaultName: `slide-${currentSlide + 1}.png` })}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Download slide"
              >
                <Download size={16} />
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-800/70 hover:bg-slate-700 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              {currentSlide < slides.length - 1 && (
                <button
                  onClick={goNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-800/70 hover:bg-slate-700 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronRight size={22} />
                </button>
              )}
            </div>

            {/* Thumbnail sidebar */}
            <div className="w-32 border-l border-slate-800 bg-slate-900/50 overflow-y-auto py-3 px-2 flex flex-col gap-2">
              {slides.map((s, i) => {
                const thumbPath = isHybrid ? (s as HybridSlideData).imagePath : (s as ImageSlideData).imagePath
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      i === currentSlide
                        ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                        : 'border-transparent hover:border-slate-600'
                    }`}
                  >
                    <img
                      src={`local-file://${thumbPath}`}
                      alt={`Slide ${i + 1}`}
                      className="w-full aspect-video object-cover"
                    />
                    <span className={`absolute bottom-0.5 right-1 text-[10px] font-medium ${
                      i === currentSlide ? 'text-indigo-300' : 'text-slate-500'
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
            <div className="px-5 py-3 bg-slate-900/80 border-t border-slate-800">
              <div className="flex items-start gap-2">
                <StickyNote size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {slide.speakerNotes}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
