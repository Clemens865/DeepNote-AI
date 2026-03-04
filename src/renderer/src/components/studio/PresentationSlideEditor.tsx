import { useState, useCallback, useRef, useEffect } from 'react'
import { RefreshCw, Loader2, Plus, Trash2, ImageIcon, Sparkles } from 'lucide-react'
import type { StructuredSlide, SlideBodyContent, PresentationSlideLayout } from '@shared/types'

interface PresentationSlideEditorProps {
  slide: StructuredSlide
  contentId?: string
  onUpdateSlide: (slide: StructuredSlide) => void
  onRegenSlide: (slideId: string, instruction?: string) => void
  onGenerateImage?: (slideId: string, bodyContentId: string, prompt: string) => Promise<void>
  isRegenerating: boolean
}

const LAYOUT_OPTIONS: { value: PresentationSlideLayout; label: string }[] = [
  { value: 'title-slide', label: 'Title Slide' },
  { value: 'section-header', label: 'Section Header' },
  { value: 'content', label: 'Content' },
  { value: 'two-column', label: 'Two Column' },
  { value: 'card-grid', label: 'Card Grid' },
  { value: 'stat-row', label: 'Statistics Row' },
  { value: 'quote', label: 'Quote' },
  { value: 'closing', label: 'Closing' },
]

export function PresentationSlideEditor({
  slide,
  contentId,
  onUpdateSlide,
  onRegenSlide,
  onGenerateImage,
  isRegenerating,
}: PresentationSlideEditorProps) {
  const [regenInstruction, setRegenInstruction] = useState('')
  const [showRegenInput, setShowRegenInput] = useState(false)
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null)
  const [imagePrompts, setImagePrompts] = useState<Record<string, string>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedUpdate = useCallback((updatedSlide: StructuredSlide) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onUpdateSlide(updatedSlide)
    }, 800)
  }, [onUpdateSlide])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const updateTitle = useCallback((title: string) => {
    const updated = { ...slide, title }
    debouncedUpdate(updated)
  }, [slide, debouncedUpdate])

  const updateSubtitle = useCallback((subtitle: string) => {
    const updated = { ...slide, subtitle }
    debouncedUpdate(updated)
  }, [slide, debouncedUpdate])

  const updateNotes = useCallback((notes: string) => {
    const updated = { ...slide, notes }
    debouncedUpdate(updated)
  }, [slide, debouncedUpdate])

  const updateLayout = useCallback((layout: PresentationSlideLayout) => {
    onUpdateSlide({ ...slide, layout })
  }, [slide, onUpdateSlide])

  const updateBodyContent = useCallback((idx: number, updates: Partial<SlideBodyContent>) => {
    const newBody = [...slide.bodyContent]
    newBody[idx] = { ...newBody[idx], ...updates }
    debouncedUpdate({ ...slide, bodyContent: newBody })
  }, [slide, debouncedUpdate])

  const updateBullet = useCallback((bodyIdx: number, bulletIdx: number, value: string) => {
    const newBody = [...slide.bodyContent]
    const bullets = [...(newBody[bodyIdx].bullets || [])]
    bullets[bulletIdx] = value
    newBody[bodyIdx] = { ...newBody[bodyIdx], bullets }
    debouncedUpdate({ ...slide, bodyContent: newBody })
  }, [slide, debouncedUpdate])

  const addBullet = useCallback((bodyIdx: number) => {
    const newBody = [...slide.bodyContent]
    const bullets = [...(newBody[bodyIdx].bullets || []), '']
    newBody[bodyIdx] = { ...newBody[bodyIdx], bullets }
    onUpdateSlide({ ...slide, bodyContent: newBody })
  }, [slide, onUpdateSlide])

  const removeBullet = useCallback((bodyIdx: number, bulletIdx: number) => {
    const newBody = [...slide.bodyContent]
    const bullets = [...(newBody[bodyIdx].bullets || [])]
    bullets.splice(bulletIdx, 1)
    newBody[bodyIdx] = { ...newBody[bodyIdx], bullets }
    onUpdateSlide({ ...slide, bodyContent: newBody })
  }, [slide, onUpdateSlide])

  const removeBodyContent = useCallback((idx: number) => {
    const newBody = slide.bodyContent.filter((_, i) => i !== idx)
    onUpdateSlide({ ...slide, bodyContent: newBody })
  }, [slide, onUpdateSlide])

  const addImageBlock = useCallback(() => {
    const newItem: SlideBodyContent = {
      id: `bc-img-${Date.now()}`,
      type: 'image-placeholder',
      text: 'AI Generated Image',
    }
    const newBody = [...slide.bodyContent, newItem]
    onUpdateSlide({ ...slide, bodyContent: newBody })
  }, [slide, onUpdateSlide])

  const handleGenerateImage = useCallback(async (bodyContentId: string) => {
    if (!onGenerateImage || !contentId) return
    const prompt = imagePrompts[bodyContentId]?.trim()
    if (!prompt) return

    setGeneratingImageId(bodyContentId)
    try {
      await onGenerateImage(slide.id, bodyContentId, prompt)
    } finally {
      setGeneratingImageId(null)
    }
  }, [slide.id, contentId, imagePrompts, onGenerateImage])

  const handleRegen = useCallback(() => {
    onRegenSlide(slide.id, regenInstruction.trim() || undefined)
    setShowRegenInput(false)
    setRegenInstruction('')
  }, [slide.id, regenInstruction, onRegenSlide])

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {/* Layout selector */}
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider w-14">Layout</label>
        <select
          value={slide.layout}
          onChange={(e) => updateLayout(e.target.value as PresentationSlideLayout)}
          className="flex-1 text-xs px-2 py-1 rounded-md border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-400"
        >
          {LAYOUT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 block">Title</label>
        <input
          type="text"
          defaultValue={slide.title}
          onChange={(e) => updateTitle(e.target.value)}
          className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-400"
        />
      </div>

      {/* Subtitle */}
      <div>
        <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 block">Subtitle</label>
        <input
          type="text"
          defaultValue={slide.subtitle || ''}
          onChange={(e) => updateSubtitle(e.target.value)}
          placeholder="Optional subtitle"
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-400"
        />
      </div>

      {/* Body Content */}
      <div>
        <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Content Blocks</label>
        <div className="space-y-3">
          {slide.bodyContent.map((item, idx) => (
            <div key={item.id} className="border border-black/[0.04] dark:border-white/[0.04] rounded-lg p-3 bg-black/[0.01] dark:bg-white/[0.01]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 uppercase">{item.type}</span>
                <button
                  onClick={() => removeBodyContent(idx)}
                  className="text-zinc-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>

              {item.type === 'text' && (
                <textarea
                  defaultValue={item.text || ''}
                  onChange={(e) => updateBodyContent(idx, { text: e.target.value })}
                  rows={3}
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.04] dark:border-white/[0.04] bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-400 resize-none"
                />
              )}

              {item.type === 'bullets' && (
                <div className="space-y-1">
                  {(item.bullets || []).map((bullet, bi) => (
                    <div key={bi} className="flex items-center gap-1">
                      <span className="text-zinc-300 text-[10px]">-</span>
                      <input
                        type="text"
                        defaultValue={bullet}
                        onChange={(e) => updateBullet(idx, bi, e.target.value)}
                        className="flex-1 px-2 py-1 text-xs rounded-md border border-black/[0.04] dark:border-white/[0.04] bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-400"
                      />
                      <button onClick={() => removeBullet(idx, bi)} className="text-zinc-300 hover:text-red-500">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addBullet(idx)}
                    className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-indigo-500 mt-1"
                  >
                    <Plus size={10} /> Add bullet
                  </button>
                </div>
              )}

              {item.type === 'stat' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[8px] text-zinc-400 mb-0.5 block">Value</label>
                    <input
                      type="text"
                      defaultValue={item.statValue || ''}
                      onChange={(e) => updateBodyContent(idx, { statValue: e.target.value })}
                      className="w-full px-2 py-1 text-xs font-bold rounded-md border border-black/[0.04] dark:border-white/[0.04] bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[8px] text-zinc-400 mb-0.5 block">Label</label>
                    <input
                      type="text"
                      defaultValue={item.statLabel || ''}
                      onChange={(e) => updateBodyContent(idx, { statLabel: e.target.value })}
                      className="w-full px-2 py-1 text-xs rounded-md border border-black/[0.04] dark:border-white/[0.04] bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              )}

              {item.type === 'quote' && (
                <textarea
                  defaultValue={item.text || ''}
                  onChange={(e) => updateBodyContent(idx, { text: e.target.value })}
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-xs italic rounded-md border border-black/[0.04] dark:border-white/[0.04] bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-400 resize-none"
                />
              )}

              {item.type === 'image-placeholder' && (
                <div className="space-y-2">
                  {/* Image preview */}
                  {item.imagePath ? (
                    <div className="rounded-lg overflow-hidden border border-black/[0.06] dark:border-white/[0.06]">
                      <img
                        src={`local-file://${item.imagePath}`}
                        alt={item.imagePrompt || 'Generated image'}
                        className="w-full h-auto max-h-40 object-contain bg-black/5 dark:bg-white/5"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6 rounded-lg border-2 border-dashed border-black/[0.08] dark:border-white/[0.08] text-zinc-400 dark:text-zinc-500">
                      <ImageIcon size={20} className="mr-2 opacity-50" />
                      <span className="text-[10px]">No image generated yet</span>
                    </div>
                  )}

                  {/* Prompt + Generate */}
                  {onGenerateImage && contentId && (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={imagePrompts[item.id] ?? (item.imagePrompt || '')}
                        onChange={(e) => setImagePrompts(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Describe the image to generate..."
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-md border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 focus:outline-none focus:border-indigo-400"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleGenerateImage(item.id) }}
                        disabled={generatingImageId === item.id}
                      />
                      <button
                        onClick={() => handleGenerateImage(item.id)}
                        disabled={generatingImageId === item.id || !(imagePrompts[item.id]?.trim() || item.imagePrompt?.trim())}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {generatingImageId === item.id ? (
                          <><Loader2 size={10} className="animate-spin" /> Generating...</>
                        ) : (
                          <><Sparkles size={10} /> Generate</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add content block buttons */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={addImageBlock}
            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-indigo-500 transition-colors"
          >
            <ImageIcon size={10} /> Add Image Block
          </button>
        </div>
      </div>

      {/* Speaker Notes */}
      <div>
        <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 block">Speaker Notes</label>
        <textarea
          defaultValue={slide.notes || ''}
          onChange={(e) => updateNotes(e.target.value)}
          rows={2}
          placeholder="Notes for the presenter..."
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-400 resize-none"
        />
      </div>

      {/* Regenerate */}
      <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
        {!showRegenInput ? (
          <button
            onClick={() => setShowRegenInput(true)}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50 transition-colors"
          >
            {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {isRegenerating ? 'Regenerating...' : 'Regenerate this slide with AI'}
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={regenInstruction}
              onChange={(e) => setRegenInstruction(e.target.value)}
              placeholder="Optional: describe what to change..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 focus:outline-none focus:border-indigo-400"
              onKeyDown={(e) => { if (e.key === 'Enter') handleRegen() }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleRegen}
                className="px-3 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={() => setShowRegenInput(false)}
                className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
