import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, Loader2, Check, Palette } from 'lucide-react'
import { IMAGE_MODELS, type ImageModelId } from '../../../../shared/types'

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
    description: 'Purple & cyan neon glow, cyberpunk',
    colorPalette: ['#0a0a14', '#a855f7', '#22d3ee', '#e2e8f0'],
  },
  {
    id: 'glass-morph',
    name: 'Glass Morphism',
    description: 'Frosted glass panels, dark gradient',
    colorPalette: ['#0f172a', '#e2e8f0', '#818cf8', '#94a3b8'],
  },
  {
    id: 'gradient-mesh',
    name: 'Gradient Mesh',
    description: 'Pink-to-blue gradient, startup feel',
    colorPalette: ['#0c1222', '#ec4899', '#3b82f6', '#e2e8f0'],
  },
  {
    id: 'terminal-hacker',
    name: 'Terminal',
    description: 'Phosphor green, hacker aesthetic',
    colorPalette: ['#0a0f0a', '#22c55e', '#4ade80', '#d1fae5'],
  },
  {
    id: 'cosmic-dark',
    name: 'Cosmic Dark',
    description: 'Violet & rose nebula, starfield',
    colorPalette: ['#06060e', '#8b5cf6', '#f43f5e', '#e2e8f0'],
  },
  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    description: 'Ice blue & white, crystalline shapes',
    colorPalette: ['#0f1729', '#38bdf8', '#f8fafc', '#64748b'],
  },
]

interface InfographicWizardProps {
  notebookId: string
  onComplete: (contentId: string) => void
  onClose: () => void
}

export function InfographicWizard({ notebookId, onComplete, onClose }: InfographicWizardProps) {
  const [selectedStyle, setSelectedStyle] = useState('neon-circuit')
  const [customStylePath, setCustomStylePath] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '1:1'>('4:3')
  const [renderMode, setRenderMode] = useState<'full-image' | 'hybrid'>('full-image')
  const [userInstructions, setUserInstructions] = useState('')
  const [imageModel, setImageModel] = useState<ImageModelId>('nano-banana-pro')

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
  const [generatedContentId, setGeneratedContentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isGenerating) return

    const cleanupProgress = window.api.onInfographicProgress(
      (data: { generatedContentId: string; stage: string; message: string }) => {
        if (generatedContentId && data.generatedContentId !== generatedContentId) return
        setProgressMessage(data.message)
      }
    )

    const cleanupComplete = window.api.onInfographicComplete(
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
      const result = await window.api.infographicStart({
        notebookId,
        stylePresetId: selectedStyle === 'custom' ? 'neon-circuit' : selectedStyle,
        aspectRatio,
        renderMode,
        userInstructions: userInstructions.trim() || undefined,
        customStyleImagePath: customStylePath ?? undefined,
        imageModel,
        ...(selectedStyle === 'custom-builder' ? {
          customStyleColors: customColors,
          customStyleDescription: customStyleDesc.trim() || 'modern, clean, professional infographic with icons and data visualization elements',
        } : {}),
      })
      setGeneratedContentId(result.generatedContentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
      setIsGenerating(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/[0.06] w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.04] shrink-0 rounded-t-2xl">
          <h2 className="font-bold text-zinc-800 dark:text-zinc-100">Customize Infographic</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
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
                    placeholder="e.g. flat design with bold icons, watercolor, retro vintage..."
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

          {/* Aspect Ratio */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Aspect Ratio
            </label>
            <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
              {(['4:3', '16:9', '1:1'] as const).map((opt) => (
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

          {/* Render Mode */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Render Mode
            </label>
            <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
              <button
                onClick={() => setRenderMode('full-image')}
                className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                  renderMode === 'full-image'
                    ? 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                }`}
              >
                {renderMode === 'full-image' && <Check size={12} />}
                Full Image
              </button>
              <button
                onClick={() => setRenderMode('hybrid')}
                className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                  renderMode === 'hybrid'
                    ? 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                }`}
              >
                {renderMode === 'hybrid' && <Check size={12} />}
                Hybrid
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
              {renderMode === 'full-image'
                ? 'AI generates the complete infographic with text baked into the image'
                : 'AI generates a background image, text is overlaid as HTML'}
            </p>
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

          {/* Custom instructions */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Instructions (optional)
            </label>
            <textarea
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              placeholder='Guide the infographic content — e.g. "Focus on the comparison between X and Y" or "Highlight the key statistics"'
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
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="text-indigo-500 animate-spin" />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{progressMessage}</p>
            </div>
          )}

          {/* Generate button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate Infographic'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
