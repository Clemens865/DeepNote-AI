import { useState, useEffect, useRef, useCallback } from 'react'
import { Download, ExternalLink, Maximize2, FileDown, Eye, Edit3 } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'
import { PresentationSlideNav } from '../PresentationSlideNav'
import { PresentationSlideEditor } from '../PresentationSlideEditor'
import type { StructuredSlide } from '@shared/types'

interface HtmlPresentationViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
  contentId?: string
}

export function HtmlPresentationView({ data, title, contentId }: HtmlPresentationViewProps) {
  const html = (data.html as string) || ''
  const slides = (data.slides as StructuredSlide[] | undefined) || null
  const outputMode = (data.outputMode as string | undefined) || 'html'
  const pptxPath = data.pptxPath as string | undefined

  const isStructured = !!slides && slides.length > 0
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(slides?.[0]?.id || null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [localSlides, setLocalSlides] = useState<StructuredSlide[]>(slides || [])
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const prevHtmlRef = useRef<string>('')

  // Sync localSlides when data changes externally
  useEffect(() => {
    if (slides) setLocalSlides(slides)
  }, [slides])

  // Create blob URL for iframe
  useEffect(() => {
    const currentHtml = (data.html as string) || ''
    if (!currentHtml || currentHtml === prevHtmlRef.current) return
    prevHtmlRef.current = currentHtml

    if (blobUrl) URL.revokeObjectURL(blobUrl)
    const blob = new Blob([currentHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [data.html]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Refresh the blob URL with new HTML */
  const refreshPreview = useCallback((newHtml: string) => {
    prevHtmlRef.current = newHtml
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    const blob = new Blob([newHtml], { type: 'text/html' })
    setBlobUrl(URL.createObjectURL(blob))
  }, [blobUrl])

  const selectedSlide = localSlides.find(s => s.id === selectedSlideId) || null

  const handleExportHtml = async () => {
    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
    await window.api.studioSaveHtml({ html, defaultName: `${safeName}.html` })
  }

  const handleOpenInBrowser = async () => {
    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
    await window.api.studioOpenHtmlTemp({ html, filename: `${safeName}.html` })
  }

  const handleExportPptx = async () => {
    if (!contentId) return
    try {
      await window.api.htmlPresentationExportPptx({ generatedContentId: contentId })
    } catch (err) {
      console.error('PPTX export failed:', err)
    }
  }

  const handleOpenPptx = async () => {
    if (pptxPath) {
      await window.api.systemOpenFile({ filePath: pptxPath })
    }
  }

  const handleUpdateSlide = useCallback(async (slide: StructuredSlide) => {
    if (!contentId) return
    setLocalSlides(prev => prev.map(s => s.id === slide.id ? slide : s))
    try {
      const result = await window.api.htmlPresentationUpdateSlide({ generatedContentId: contentId, slide })
      if (result?.html) {
        refreshPreview(result.html)
      }
    } catch (err) {
      console.error('Failed to update slide:', err)
    }
  }, [contentId, refreshPreview])

  const handleRegenSlide = useCallback(async (slideId: string, instruction?: string) => {
    if (!contentId) return
    setIsRegenerating(true)
    try {
      const result = await window.api.htmlPresentationRegenSlide({
        generatedContentId: contentId,
        slideId,
        instruction,
      })
      if (result?.slide) {
        setLocalSlides(prev => prev.map(s => s.id === slideId ? result.slide : s))
      }
      if (result?.html) {
        refreshPreview(result.html)
      }
    } catch (err) {
      console.error('Failed to regenerate slide:', err)
    } finally {
      setIsRegenerating(false)
    }
  }, [contentId, refreshPreview])

  const handleGenerateImage = useCallback(async (slideId: string, bodyContentId: string, prompt: string) => {
    if (!contentId) return
    try {
      const result = await window.api.htmlPresentationGenerateImage({
        generatedContentId: contentId,
        slideId,
        bodyContentId,
        prompt,
      })
      if (result?.slide) {
        setLocalSlides(prev => prev.map(s => s.id === slideId ? result.slide : s))
      }
      if (result?.html) {
        refreshPreview(result.html)
      }
    } catch (err) {
      console.error('Failed to generate image:', err)
    }
  }, [contentId, refreshPreview])

  const handleReorderSlides = useCallback(async (slideIds: string[]) => {
    if (!contentId) return
    const slideMap = new Map(localSlides.map(s => [s.id, s]))
    const reordered = slideIds
      .map(id => slideMap.get(id))
      .filter((s): s is StructuredSlide => !!s)
      .map((s, i) => ({ ...s, slideNumber: i + 1 }))
    setLocalSlides(reordered)
    try {
      await window.api.htmlPresentationReorderSlides({ generatedContentId: contentId, slideIds })
    } catch (err) {
      console.error('Failed to reorder slides:', err)
    }
  }, [contentId, localSlides])

  const handleDeleteSlide = useCallback(async (slideId: string) => {
    const newSlides = localSlides.filter(s => s.id !== slideId)
    setLocalSlides(newSlides)
    if (selectedSlideId === slideId) {
      setSelectedSlideId(newSlides[0]?.id || null)
    }
    if (contentId) {
      await window.api.htmlPresentationReorderSlides({
        generatedContentId: contentId,
        slideIds: newSlides.map(s => s.id),
      })
    }
  }, [contentId, localSlides, selectedSlideId])

  const handleAddSlide = useCallback(async () => {
    const newSlide: StructuredSlide = {
      id: `slide-${Date.now()}`,
      slideNumber: localSlides.length + 1,
      layout: 'content',
      title: 'New Slide',
      bodyContent: [{ id: `bc-${Date.now()}`, type: 'text', text: 'Add your content here...' }],
    }
    const newSlides = [...localSlides, newSlide]
    setLocalSlides(newSlides)
    setSelectedSlideId(newSlide.id)
    setMode('edit')
    if (contentId) {
      await window.api.htmlPresentationUpdateSlide({ generatedContentId: contentId, slide: newSlide })
    }
  }, [contentId, localSlides])

  // Legacy view: no structured slides (old { html } format)
  if (!isStructured && !html) {
    return (
      <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-sm">
        No content generated.
      </div>
    )
  }

  // Legacy iframe-only view
  if (!isStructured) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={handleExportHtml} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
            <Download size={13} /> Export HTML
          </button>
          <button onClick={handleOpenInBrowser} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
            <ExternalLink size={13} /> Open in Browser
          </button>
          <div className="flex-1" />
          <button onClick={() => setIsFullscreen(true)} className="px-2 py-1 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors" title="Fullscreen">
            <Maximize2 size={14} />
          </button>
        </div>
        <div className="rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.06] bg-black">
          {blobUrl && <iframe src={blobUrl} className="w-full border-0" style={{ height: 500 }} title="HTML Presentation Preview" />}
        </div>
        <FullscreenWrapper isOpen={isFullscreen} onClose={() => setIsFullscreen(false)} title={title} wide>
          {blobUrl && <iframe src={blobUrl} className="w-full h-full border-0 rounded-lg" style={{ minHeight: 'calc(100vh - 120px)' }} title="HTML Presentation" />}
        </FullscreenWrapper>
      </div>
    )
  }

  // Full structured view with editor + navigator
  const actionBar = (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/50 dark:bg-zinc-900/50">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
        <button
          onClick={() => setMode('preview')}
          className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium transition-colors ${
            mode === 'preview'
              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <Eye size={11} /> Preview
        </button>
        <button
          onClick={() => setMode('edit')}
          className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium transition-colors ${
            mode === 'edit'
              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <Edit3 size={11} /> Edit
        </button>
      </div>

      <div className="flex-1" />

      {html && (
        <>
          <button onClick={handleExportHtml} className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
            <Download size={11} /> HTML
          </button>
          <button onClick={handleOpenInBrowser} className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
            <ExternalLink size={11} /> Browser
          </button>
        </>
      )}

      {isStructured && contentId && (
        <button onClick={handleExportPptx} className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
          <FileDown size={11} /> PPTX
        </button>
      )}

      {pptxPath && outputMode === 'pptx' && (
        <button onClick={handleOpenPptx} className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
          <ExternalLink size={11} /> Open PPTX
        </button>
      )}

      <button onClick={() => setIsFullscreen(true)} className="px-1.5 py-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
        <Maximize2 size={12} />
      </button>
    </div>
  )

  return (
    <div className="border border-black/[0.06] dark:border-white/[0.06] rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
      {actionBar}

      <div className="flex" style={{ height: 520 }}>
        {/* Slide Navigator */}
        <PresentationSlideNav
          slides={localSlides}
          selectedSlideId={selectedSlideId}
          onSelectSlide={setSelectedSlideId}
          onReorderSlides={handleReorderSlides}
          onDeleteSlide={handleDeleteSlide}
          onRegenSlide={(id) => handleRegenSlide(id)}
          onAddSlide={handleAddSlide}
        />

        {/* Main content area */}
        <div className="flex-1 overflow-hidden">
          {mode === 'preview' ? (
            <div className="h-full bg-black">
              {blobUrl && (
                <iframe
                  src={blobUrl}
                  className="w-full h-full border-0"
                  title="HTML Presentation Preview"
                />
              )}
            </div>
          ) : (
            selectedSlide ? (
              <PresentationSlideEditor
                key={selectedSlide.id}
                slide={selectedSlide}
                contentId={contentId}
                onUpdateSlide={handleUpdateSlide}
                onRegenSlide={handleRegenSlide}
                onGenerateImage={handleGenerateImage}
                isRegenerating={isRegenerating}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
                Select a slide to edit
              </div>
            )
          )}
        </div>
      </div>

      {/* Fullscreen */}
      <FullscreenWrapper
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title={title}
        wide
      >
        {blobUrl && (
          <iframe
            src={blobUrl}
            className="w-full h-full border-0 rounded-lg"
            style={{ minHeight: 'calc(100vh - 120px)' }}
            title="HTML Presentation"
          />
        )}
      </FullscreenWrapper>
    </div>
  )
}
