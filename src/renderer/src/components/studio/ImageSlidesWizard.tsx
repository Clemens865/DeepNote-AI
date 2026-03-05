import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, Loader2, Check, Palette, Sparkles, Save, Trash2 } from 'lucide-react'
import { IMAGE_MODELS, type ImageModelId, type SlidePromptTemplate, type StyleInfluence } from '../../../../shared/types'

interface StyleOption {
  id: string
  name: string
  description: string
  colorPalette: string[]
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'neon-circuit',
    name: 'Neon Circuit',
    description: 'Purple & cyan neon glow, circuit traces, cyberpunk',
    colorPalette: ['#0a0a14', '#a855f7', '#22d3ee', '#e2e8f0'],
  },
  {
    id: 'glass-morph',
    name: 'Glass Morphism',
    description: 'Frosted glass panels, dark gradient, soft glow',
    colorPalette: ['#0f172a', '#e2e8f0', '#818cf8', '#94a3b8'],
  },
  {
    id: 'gradient-mesh',
    name: 'Gradient Mesh',
    description: 'Pink-to-blue gradient blobs, dark navy, startup feel',
    colorPalette: ['#0c1222', '#ec4899', '#3b82f6', '#e2e8f0'],
  },
  {
    id: 'terminal-hacker',
    name: 'Terminal',
    description: 'Phosphor green, matrix data streams, hacker aesthetic',
    colorPalette: ['#0a0f0a', '#22c55e', '#4ade80', '#d1fae5'],
  },
  {
    id: 'cosmic-dark',
    name: 'Cosmic Dark',
    description: 'Violet & rose nebula, starfield, deep space',
    colorPalette: ['#06060e', '#8b5cf6', '#f43f5e', '#e2e8f0'],
  },
  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    description: 'Ice blue & white, crystalline shapes, dark slate',
    colorPalette: ['#0f1729', '#38bdf8', '#f8fafc', '#64748b'],
  },
]

const FORMAT_OPTIONS = [
  {
    id: 'presentation' as const,
    name: 'Presentation',
    description: 'Educational or informational deck with clear topic flow.',
  },
  {
    id: 'pitch' as const,
    name: 'Pitch Deck',
    description: 'Persuasive business pitch: problem, solution, market, ask.',
  },
  {
    id: 'report' as const,
    name: 'Report Deck',
    description: 'Data-driven analytical report with findings and evidence.',
  },
]

interface ImageSlidesWizardProps {
  notebookId: string
  onComplete: (contentId: string) => void
  onClose: () => void
}

export function ImageSlidesWizard({ notebookId, onComplete, onClose }: ImageSlidesWizardProps) {
  // Config state
  const [renderMode, setRenderMode] = useState<'full-image' | 'hybrid'>('full-image')
  const [format, setFormat] = useState<'presentation' | 'pitch' | 'report'>('presentation')
  const [selectedStyle, setSelectedStyle] = useState('neon-circuit')
  const [customStylePath, setCustomStylePath] = useState<string | null>(null)
  const [slideCount, setSlideCount] = useState(10)
  const [isAutoSuggesting, setIsAutoSuggesting] = useState(false)
  const [autoSuggestReasoning, setAutoSuggestReasoning] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '1:1' | '9:16' | '3:4'>('16:9')
  const [userInstructions, setUserInstructions] = useState('')
  const [imageModel, setImageModel] = useState<ImageModelId>('nano-banana-pro')
  const [styleInfluence, setStyleInfluence] = useState<StyleInfluence>('style-mood')

  // Template state
  const [templates, setTemplates] = useState<SlidePromptTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templateText, setTemplateText] = useState('')
  const [newTemplateName, setNewTemplateName] = useState('')
  const [showSaveAs, setShowSaveAs] = useState(false)

  // Custom style builder state
  const [customColors, setCustomColors] = useState(['#0a0a14', '#a855f7', '#22d3ee', '#e2e8f0'])
  const [customStyleDesc, setCustomStyleDesc] = useState('')

  const updateCustomColor = useCallback((index: number, color: string) => {
    setCustomColors(prev => {
      const next = [...prev]
      next[index] = color
      return next
    })
  }, [])

  // Load templates on mount
  useEffect(() => {
    window.api.slideTemplatesList().then((tpls: SlidePromptTemplate[]) => {
      setTemplates(tpls)
      const defaultTpl = tpls.find(t => t.isDefault)
      if (defaultTpl) {
        setSelectedTemplateId(defaultTpl.id)
        setTemplateText(defaultTpl.promptText)
      }
    })
  }, [])

  const handleAutoSuggest = useCallback(async () => {
    setIsAutoSuggesting(true)
    setAutoSuggestReasoning(null)
    try {
      const result = await window.api.imageSlidesSuggestCount({ notebookId, format })
      setSlideCount(result.count)
      setAutoSuggestReasoning(result.reasoning)
    } catch {
      setAutoSuggestReasoning('Could not auto-suggest')
    } finally {
      setIsAutoSuggesting(false)
    }
  }, [notebookId, format])

  const handleSelectTemplate = useCallback((tpl: SlidePromptTemplate) => {
    setSelectedTemplateId(tpl.id)
    setTemplateText(tpl.promptText)
    setShowSaveAs(false)
  }, [])

  const handleSaveTemplate = useCallback(async () => {
    if (!selectedTemplateId) return
    const tpl = templates.find(t => t.id === selectedTemplateId)
    if (!tpl || tpl.isDefault) return
    const updated = await window.api.slideTemplatesUpdate({ id: selectedTemplateId, promptText: templateText })
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
  }, [selectedTemplateId, templateText, templates])

  const handleSaveAsNew = useCallback(async () => {
    if (!newTemplateName.trim()) return
    const created = await window.api.slideTemplatesCreate({ name: newTemplateName.trim(), promptText: templateText })
    setTemplates(prev => [...prev, created])
    setSelectedTemplateId(created.id)
    setNewTemplateName('')
    setShowSaveAs(false)
  }, [newTemplateName, templateText])

  const handleDeleteTemplate = useCallback(async () => {
    if (!selectedTemplateId) return
    const tpl = templates.find(t => t.id === selectedTemplateId)
    if (!tpl || tpl.isDefault) return
    await window.api.slideTemplatesDelete({ id: selectedTemplateId })
    const remaining = templates.filter(t => t.id !== selectedTemplateId)
    setTemplates(remaining)
    const defaultTpl = remaining.find(t => t.isDefault)
    if (defaultTpl) {
      setSelectedTemplateId(defaultTpl.id)
      setTemplateText(defaultTpl.promptText)
    }
  }, [selectedTemplateId, templates])

  // Progress state
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [totalSlides, setTotalSlides] = useState(0)
  const [generatedContentId, setGeneratedContentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isGenerating) return

    const cleanupProgress = window.api.onImageSlidesProgress(
      (data: { generatedContentId: string; stage: string; currentSlide?: number; totalSlides?: number; message: string }) => {
        if (generatedContentId && data.generatedContentId !== generatedContentId) return
        setProgressMessage(data.message)
        if (data.currentSlide != null) setCurrentSlide(data.currentSlide)
        if (data.totalSlides != null) setTotalSlides(data.totalSlides)
      }
    )

    const cleanupComplete = window.api.onImageSlidesComplete(
      (data: { generatedContentId: string; success: boolean; error?: string }) => {
        if (generatedContentId && data.generatedContentId !== generatedContentId) return
        if (data.success) {
          onComplete(data.generatedContentId)
        } else {
          setError(data.error || 'Generation failed')
          setIsGenerating(false)
        }
      }
    )

    return () => {
      cleanupProgress()
      cleanupComplete()
    }
  }, [isGenerating, generatedContentId, onComplete])

  const handleUploadReference = async () => {
    const filePath = await window.api.showOpenDialog({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    })
    if (filePath) {
      setCustomStylePath(filePath)
      setSelectedStyle('custom')
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setProgressMessage('Starting generation...')
    setError(null)

    try {
      // Determine if using template text as override
      const selectedTpl = templates.find(t => t.id === selectedTemplateId)
      const isTemplateModified = selectedTpl && templateText !== selectedTpl.promptText
      const promptOverride = isTemplateModified ? templateText : undefined
      const promptTemplateId = !isTemplateModified && selectedTemplateId && !selectedTpl?.isDefault ? selectedTemplateId : undefined

      const result = await window.api.imageSlidesStart({
        notebookId,
        stylePresetId: selectedStyle === 'custom' ? 'neon-circuit' : selectedStyle,
        format,
        slideCount,
        aspectRatio,
        userInstructions: userInstructions.trim() || undefined,
        customStyleImagePath: customStylePath ?? undefined,
        renderMode,
        imageModel,
        styleInfluence: customStylePath ? styleInfluence : undefined,
        promptTemplateId,
        promptOverride,
        ...(selectedStyle === 'custom-builder' ? {
          customStyleColors: customColors,
          customStyleDescription: customStyleDesc.trim() || 'modern, clean, professional tech aesthetic with subtle geometric elements',
        } : {}),
      })
      setGeneratedContentId(result.generatedContentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
      setIsGenerating(false)
    }
  }

  const progressPercent = totalSlides > 0 ? Math.round((currentSlide / totalSlides) * 100) : 0

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/[0.06] w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.04] shrink-0 rounded-t-2xl">
          <h2 className="font-bold text-zinc-800 dark:text-zinc-100">Customize Slide Deck</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Render Mode */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Render Mode
            </label>
            <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
              <button
                onClick={() => setRenderMode('full-image')}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  renderMode === 'full-image'
                    ? 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                }`}
              >
                Full Image
              </button>
              <button
                onClick={() => setRenderMode('hybrid')}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  renderMode === 'hybrid'
                    ? 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                }`}
              >
                Editable Text
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Beta</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
              {renderMode === 'full-image'
                ? 'Text is baked into the generated image.'
                : 'AI generates background images; titles and bullets are editable HTML overlays.'}
            </p>
          </div>

          {/* Format */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setFormat(opt.id)}
                  className={`text-left p-2.5 rounded-xl border-2 transition-all ${
                    format === opt.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-black/[0.06] dark:border-white/[0.06] hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{opt.name}</span>
                    {format === opt.id && <Check size={12} className="text-indigo-500" />}
                  </div>
                  <p className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Visual Style */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Visual Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style.id}
                  onClick={() => { setSelectedStyle(style.id); setCustomStylePath(null) }}
                  className={`text-left p-2 rounded-lg border-2 transition-all ${
                    selectedStyle === style.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-black/[0.06] dark:border-white/[0.06] hover:border-zinc-300'
                  }`}
                >
                  <div className="flex gap-0.5 mb-1.5">
                    {style.colorPalette.map((color, ci) => (
                      <div key={ci} className="w-4 h-4 rounded-sm border border-black/[0.06] dark:border-white/[0.06]" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200 leading-tight block">{style.name}</span>
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-tight block mt-0.5">{style.description}</span>
                </button>
              ))}
            </div>

            {/* Custom style builder */}
            <button
              onClick={() => { setSelectedStyle('custom-builder'); setCustomStylePath(null) }}
              className={`w-full mt-2 text-left p-2.5 rounded-lg border-2 transition-all flex items-center gap-2 ${
                selectedStyle === 'custom-builder'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-dashed border-black/[0.08] dark:border-white/[0.08] hover:border-zinc-400'
              }`}
            >
              <Palette size={14} className="text-zinc-400 flex-shrink-0" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Create your own style
              </span>
              <div className="ml-auto flex gap-0.5">
                {customColors.map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm border border-black/[0.08] dark:border-white/[0.08]" style={{ backgroundColor: c }} />
                ))}
              </div>
            </button>

            {selectedStyle === 'custom-builder' && (
              <div className="mt-2 p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {['Background', 'Primary', 'Accent', 'Text'].map((label, i) => (
                    <div key={label}>
                      <label className="text-[9px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">{label}</label>
                      <div className="relative">
                        <input
                          type="color"
                          value={customColors[i]}
                          onChange={(e) => updateCustomColor(i, e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div
                          className="w-full h-7 rounded-md border border-black/[0.06] dark:border-white/[0.06] cursor-pointer"
                          style={{ backgroundColor: customColors[i] }}
                        />
                      </div>
                      <span className="text-[8px] text-zinc-400 mt-0.5 block">{customColors[i]}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-[9px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">Style Description</label>
                  <input
                    type="text"
                    value={customStyleDesc}
                    onChange={(e) => setCustomStyleDesc(e.target.value)}
                    placeholder="e.g. futuristic holographic UI, retro pixel art, watercolor..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                {/* Preview strip */}
                <div className="flex gap-1 items-center">
                  <span className="text-[9px] text-zinc-400">Preview:</span>
                  <div className="flex-1 h-5 rounded-md flex overflow-hidden border border-black/[0.06] dark:border-white/[0.06]">
                    <div className="flex-[3]" style={{ backgroundColor: customColors[0] }} />
                    <div className="flex-1" style={{ backgroundColor: customColors[1] }} />
                    <div className="flex-1" style={{ backgroundColor: customColors[2] }} />
                    <div className="flex-[2]" style={{ backgroundColor: customColors[3] }} />
                  </div>
                </div>
              </div>
            )}

            {/* Upload reference */}
            <button
              onClick={handleUploadReference}
              className={`w-full mt-2 text-left p-2.5 rounded-lg border-2 transition-all flex items-center gap-2 ${
                selectedStyle === 'custom'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-dashed border-black/[0.08] dark:border-white/[0.08] hover:border-zinc-400'
              }`}
            >
              <Upload size={14} className="text-zinc-400 flex-shrink-0" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {customStylePath ? 'Reference image selected' : 'Upload style reference image'}
              </span>
            </button>

            {/* Style Influence — only shown when reference image is selected */}
            {customStylePath && (
              <div className="mt-2 p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg">
                <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">
                  Reference Influence
                </label>
                <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
                  {([
                    { value: 'style-only' as const, label: 'Style Only', desc: 'Colors & technique' },
                    { value: 'style-mood' as const, label: 'Style + Mood', desc: '+ atmosphere & lighting' },
                    { value: 'full-match' as const, label: 'Full Match', desc: '+ theme & composition' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStyleInfluence(opt.value)}
                      className={`flex-1 py-1.5 text-center transition-colors ${
                        styleInfluence === opt.value
                          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className="text-[10px] font-medium block">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1">
                  {styleInfluence === 'style-only'
                    ? 'Only use the reference for colors and rendering technique'
                    : styleInfluence === 'style-mood'
                      ? 'Match the visual style, atmosphere, and lighting'
                      : 'Closely replicate the reference style, theme, and composition'}
                </p>
              </div>
            )}
          </div>

          {/* Slide Count + Aspect Ratio row */}
          <div className="flex gap-4">
            <div className="flex-[2]">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
                Slides: {slideCount}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={slideCount}
                  onChange={(e) => { setSlideCount(Number(e.target.value)); setAutoSuggestReasoning(null) }}
                  className="flex-1 h-1.5 accent-indigo-500"
                />
                <button
                  onClick={handleAutoSuggest}
                  disabled={isAutoSuggesting}
                  className="px-2.5 py-1.5 text-[10px] font-medium rounded-md border border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors flex items-center gap-1 disabled:opacity-50"
                  title="AI suggests optimal slide count"
                >
                  {isAutoSuggesting ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  Auto
                </button>
              </div>
              {autoSuggestReasoning && (
                <p className="text-[9px] text-indigo-500 dark:text-indigo-400 mt-1">{autoSuggestReasoning}</p>
              )}
            </div>

            <div className="flex-1">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
                Aspect Ratio
              </label>
              <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
                {([
                  { value: '16:9', label: '16:9' },
                  { value: '4:3', label: '4:3' },
                  { value: '1:1', label: '1:1' },
                  { value: '3:4', label: '3:4' },
                  { value: '9:16', label: '9:16' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAspectRatio(opt.value)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      aspectRatio === opt.value
                        ? 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    {aspectRatio === opt.value && <Check size={12} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Image Model */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Image Model
            </label>
            <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
              {IMAGE_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setImageModel(m.id)}
                  className={`flex-1 py-2 text-center transition-colors ${
                    imageModel === m.id
                      ? 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="text-[11px] font-medium block">{m.label}</span>
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block mt-0.5">{m.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1 block">
              Style & Content Instructions
            </label>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-2">
              Controls how slides look and what text appears. Want more text? Say so. Want visual-only? Say that. You can save reusable presets.
            </p>
            {/* Template selector */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
                    selectedTemplateId === tpl.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                      : 'border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  {tpl.name}
                  {tpl.isDefault && <span className="ml-1 text-[9px] text-zinc-400">(built-in)</span>}
                </button>
              ))}
            </div>
            {/* Template text editor */}
            <textarea
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              placeholder='e.g. "Cinematic visuals with bold titles only" or "Include bullet points with key data on each slide"'
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-400 resize-none"
            />
            {/* Template action buttons */}
            <div className="flex items-center gap-2 mt-1.5">
              {selectedTemplateId && !templates.find(t => t.id === selectedTemplateId)?.isDefault && (
                <>
                  <button onClick={handleSaveTemplate} className="text-[10px] text-zinc-500 hover:text-indigo-600 flex items-center gap-0.5" title="Save changes">
                    <Save size={10} /> Save
                  </button>
                  <button onClick={handleDeleteTemplate} className="text-[10px] text-zinc-500 hover:text-red-600 flex items-center gap-0.5" title="Delete template">
                    <Trash2 size={10} /> Delete
                  </button>
                </>
              )}
              <button onClick={() => setShowSaveAs(!showSaveAs)} className="text-[10px] text-zinc-500 hover:text-indigo-600 flex items-center gap-0.5">
                <Save size={10} /> Save as New
              </button>
            </div>
            {showSaveAs && (
              <div className="flex gap-2 mt-1.5">
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Template name..."
                  className="flex-1 px-2 py-1 text-xs rounded-md border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-400"
                />
                <button onClick={handleSaveAsNew} disabled={!newTemplateName.trim()} className="px-2.5 py-1 text-[10px] font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                  Create
                </button>
              </div>
            )}

            {/* Content-specific instructions */}
            <textarea
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              placeholder='Optional: specific content guidance, e.g. "Focus on Q3 results" or "Target audience: investors"'
              rows={1}
              className="w-full mt-2 px-3 py-2 text-sm rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-indigo-500 animate-spin" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{progressMessage}</p>
              </div>
              {totalSlides > 0 && (
                <div className="w-full bg-black/[0.06] dark:bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Generate button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
