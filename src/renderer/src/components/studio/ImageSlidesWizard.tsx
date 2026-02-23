import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, Loader2, Check, Palette } from 'lucide-react'

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

const LENGTH_OPTIONS = [
  { id: 'test' as const, label: 'Test (3)', count: 3 },
  { id: 'short' as const, label: 'Short (5)', count: 5 },
  { id: 'default' as const, label: 'Default (10)', count: 10 },
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
  const [length, setLength] = useState<'test' | 'short' | 'default'>('default')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3'>('16:9')
  const [userInstructions, setUserInstructions] = useState('')

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
      const result = await window.api.imageSlidesStart({
        notebookId,
        stylePresetId: selectedStyle === 'custom' ? 'neon-circuit' : selectedStyle,
        format,
        length,
        aspectRatio,
        userInstructions: userInstructions.trim() || undefined,
        customStyleImagePath: customStylePath ?? undefined,
        renderMode,
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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/[0.06] w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
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
          </div>

          {/* Length + Aspect Ratio row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
                Length
              </label>
              <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
                {LENGTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setLength(opt.id)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      length === opt.id
                        ? 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    {length === opt.id && <Check size={12} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
                Aspect Ratio
              </label>
              <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
                {(['16:9', '4:3'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAspectRatio(opt)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      aspectRatio === opt
                        ? 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    {aspectRatio === opt && <Check size={12} />}
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description / Custom Instructions */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Describe the slide deck you want to create
            </label>
            <textarea
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              placeholder='Guide the content focus, audience, or outline. Example: "Create a beginner-friendly overview focusing on practical examples."'
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-400 resize-none"
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
