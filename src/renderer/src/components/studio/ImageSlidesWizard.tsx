import { useState, useEffect } from 'react'
import { X, Upload, Loader2, Check } from 'lucide-react'

interface StyleOption {
  id: string
  name: string
  description: string
  colorPalette: string[]
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'blueprint-dark',
    name: 'Blueprint Dark',
    description: 'Dark teal, orange & cyan accents, technical diagrams',
    colorPalette: ['#0f2b3c', '#f97316', '#06b6d4', '#e2e8f0'],
  },
  {
    id: 'editorial-clean',
    name: 'Editorial Clean',
    description: 'Cream background, orange & blue, hand-drawn sketches',
    colorPalette: ['#faf5eb', '#ea580c', '#1e5fa6', '#18181b'],
  },
  {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    description: 'White background, navy & light blue, geometric icons',
    colorPalette: ['#ffffff', '#1e3a5f', '#3b82f6', '#64748b'],
  },
  {
    id: 'bold-minimal',
    name: 'Bold Minimal',
    description: 'White, black text, red accent, large typography',
    colorPalette: ['#ffffff', '#18181b', '#dc2626', '#71717a'],
  },
  {
    id: 'nature-warm',
    name: 'Nature Warm',
    description: 'Cream, forest green & terracotta, leaf patterns',
    colorPalette: ['#fef9ef', '#2d5016', '#c2410c', '#d4a76a'],
  },
  {
    id: 'dark-luxe',
    name: 'Dark Luxe',
    description: 'Black background, gold & white, elegant lines',
    colorPalette: ['#0c0c0c', '#c9a84c', '#ffffff', '#2a2a2a'],
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
  const [selectedStyle, setSelectedStyle] = useState('blueprint-dark')
  const [customStylePath, setCustomStylePath] = useState<string | null>(null)
  const [length, setLength] = useState<'test' | 'short' | 'default'>('default')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3'>('16:9')
  const [userInstructions, setUserInstructions] = useState('')

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
        stylePresetId: selectedStyle === 'custom' ? 'blueprint-dark' : selectedStyle,
        format,
        length,
        aspectRatio,
        userInstructions: userInstructions.trim() || undefined,
        customStyleImagePath: customStylePath ?? undefined,
        renderMode,
      })
      setGeneratedContentId(result.generatedContentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
      setIsGenerating(false)
    }
  }

  const progressPercent = totalSlides > 0 ? Math.round((currentSlide / totalSlides) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 rounded-t-2xl">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Customize Slide Deck</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Render Mode */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              Render Mode
            </label>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setRenderMode('full-image')}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  renderMode === 'full-image'
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Full Image
              </button>
              <button
                onClick={() => setRenderMode('hybrid')}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  renderMode === 'hybrid'
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Editable Text
              </button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              {renderMode === 'full-image'
                ? 'Text is baked into the generated image.'
                : 'AI generates background images; titles and bullets are editable HTML overlays.'}
            </p>
          </div>

          {/* Format */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
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
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{opt.name}</span>
                    {format === opt.id && <Check size={12} className="text-indigo-500" />}
                  </div>
                  <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Visual Style */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
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
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex gap-0.5 mb-1.5">
                    {style.colorPalette.map((color, ci) => (
                      <div key={ci} className="w-4 h-4 rounded-sm border border-slate-200 dark:border-slate-600" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 leading-tight block">{style.name}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight block mt-0.5">{style.description}</span>
                </button>
              ))}
            </div>
            {/* Upload reference */}
            <button
              onClick={handleUploadReference}
              className={`w-full mt-2 text-left p-2.5 rounded-lg border-2 transition-all flex items-center gap-2 ${
                selectedStyle === 'custom'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400'
              }`}
            >
              <Upload size={14} className="text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {customStylePath ? 'Reference image selected' : 'Upload style reference image'}
              </span>
            </button>
          </div>

          {/* Length + Aspect Ratio row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                Length
              </label>
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {LENGTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setLength(opt.id)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      length === opt.id
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {length === opt.id && <Check size={12} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                Aspect Ratio
              </label>
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {(['16:9', '4:3'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAspectRatio(opt)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      aspectRatio === opt
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              Describe the slide deck you want to create
            </label>
            <textarea
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              placeholder='Guide the content focus, audience, or outline. Example: "Create a beginner-friendly overview focusing on practical examples."'
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-400 resize-none"
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
                <p className="text-xs text-slate-500 dark:text-slate-400">{progressMessage}</p>
              </div>
              {totalSlides > 0 && (
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
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
    </div>
  )
}
