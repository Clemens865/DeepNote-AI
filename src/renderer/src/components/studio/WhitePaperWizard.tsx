import { useState, useEffect, useCallback } from 'react'
import { X, Upload, Loader2, Palette, FileText } from 'lucide-react'

interface StyleOption {
  id: string
  name: string
  description: string
  colorPalette: string[]
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'glass-morph',
    name: 'Glass Morphism',
    description: 'Frosted glass panels, dark gradient',
    colorPalette: ['#0f172a', '#e2e8f0', '#818cf8', '#94a3b8'],
  },
  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    description: 'Ice blue & white, crystalline',
    colorPalette: ['#0f1729', '#38bdf8', '#f8fafc', '#64748b'],
  },
  {
    id: 'gradient-mesh',
    name: 'Gradient Mesh',
    description: 'Pink-to-blue gradient, modern',
    colorPalette: ['#0c1222', '#ec4899', '#3b82f6', '#e2e8f0'],
  },
  {
    id: 'neon-circuit',
    name: 'Neon Circuit',
    description: 'Purple & cyan neon glow',
    colorPalette: ['#0a0a14', '#a855f7', '#22d3ee', '#e2e8f0'],
  },
  {
    id: 'cosmic-dark',
    name: 'Cosmic Dark',
    description: 'Violet & rose nebula',
    colorPalette: ['#06060e', '#8b5cf6', '#f43f5e', '#e2e8f0'],
  },
  {
    id: 'terminal-hacker',
    name: 'Terminal',
    description: 'Phosphor green, developer',
    colorPalette: ['#0a0f0a', '#22c55e', '#4ade80', '#d1fae5'],
  },
]

interface WhitePaperWizardProps {
  notebookId: string
  onComplete: (contentId: string) => void
  onClose: () => void
}

export function WhitePaperWizard({ notebookId, onComplete, onClose }: WhitePaperWizardProps) {
  const [tone, setTone] = useState<'academic' | 'business' | 'technical'>('business')
  const [length, setLength] = useState<'concise' | 'standard' | 'comprehensive'>('standard')
  const [selectedStyle, setSelectedStyle] = useState('glass-morph')
  const [customStylePath, setCustomStylePath] = useState<string | null>(null)
  const [userInstructions, setUserInstructions] = useState('')

  // Custom style builder state
  const [customColors, setCustomColors] = useState(['#0f172a', '#6366f1', '#38bdf8', '#e2e8f0'])
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

    const cleanupProgress = window.api.onWhitepaperProgress(
      (data: { generatedContentId: string; stage: string; currentSection?: number; totalSections?: number; message: string }) => {
        if (generatedContentId && data.generatedContentId !== generatedContentId) return
        setProgressMessage(data.message)
      }
    )

    const cleanupComplete = window.api.onWhitepaperComplete(
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
    setProgressMessage('Starting white paper generation...')
    setError(null)

    try {
      const result = await window.api.whitepaperStart({
        notebookId,
        tone,
        length,
        stylePresetId: selectedStyle === 'custom' ? 'glass-morph' : selectedStyle,
        userInstructions: userInstructions.trim() || undefined,
        customStyleImagePath: customStylePath ?? undefined,
        ...(selectedStyle === 'custom-builder' ? {
          customStyleColors: customColors,
          customStyleDescription: customStyleDesc.trim() || 'clean, modern, professional design with subtle gradients',
        } : {}),
      })
      setGeneratedContentId(result.generatedContentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">Generate White Paper</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tone */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              Tone
            </label>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {([
                { value: 'academic' as const, label: 'Academic', desc: 'Formal & scholarly' },
                { value: 'business' as const, label: 'Business', desc: 'Professional & accessible' },
                { value: 'technical' as const, label: 'Technical', desc: 'Precise & implementation-focused' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTone(opt.value)}
                  className={`flex-1 py-2.5 text-center transition-colors ${
                    tone === opt.value
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-xs font-medium block">{opt.label}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Length */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              Length
            </label>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {([
                { value: 'concise' as const, label: 'Concise', desc: '3-4 sections' },
                { value: 'standard' as const, label: 'Standard', desc: '4-6 sections' },
                { value: 'comprehensive' as const, label: 'Comprehensive', desc: '6-8 sections' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLength(opt.value)}
                  className={`flex-1 py-2.5 text-center transition-colors flex flex-col items-center gap-0.5 ${
                    length === opt.value
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Image Style */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              Image Style
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

            {/* Custom style builder */}
            <button
              onClick={() => { setSelectedStyle('custom-builder'); setCustomStylePath(null) }}
              className={`w-full mt-2 text-left p-2.5 rounded-lg border-2 transition-all flex items-center gap-2 ${
                selectedStyle === 'custom-builder'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400'
              }`}
            >
              <Palette size={14} className="text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Create your own style
              </span>
              <div className="ml-auto flex gap-0.5">
                {customColors.map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm border border-slate-300 dark:border-slate-600" style={{ backgroundColor: c }} />
                ))}
              </div>
            </button>

            {selectedStyle === 'custom-builder' && (
              <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {['Background', 'Primary', 'Accent', 'Text'].map((label, i) => (
                    <div key={label}>
                      <label className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mb-1 block">{label}</label>
                      <div className="relative">
                        <input
                          type="color"
                          value={customColors[i]}
                          onChange={(e) => updateCustomColor(i, e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div
                          className="w-full h-7 rounded-md border border-slate-200 dark:border-slate-600 cursor-pointer"
                          style={{ backgroundColor: customColors[i] }}
                        />
                      </div>
                      <span className="text-[8px] text-slate-400 mt-0.5 block">{customColors[i]}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mb-1 block">Style Description</label>
                  <input
                    type="text"
                    value={customStyleDesc}
                    onChange={(e) => setCustomStyleDesc(e.target.value)}
                    placeholder="e.g. watercolor, minimalist, corporate blueprint..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="flex gap-1 items-center">
                  <span className="text-[9px] text-slate-400">Preview:</span>
                  <div className="flex-1 h-5 rounded-md flex overflow-hidden border border-slate-200 dark:border-slate-600">
                    <div className="flex-[3]" style={{ backgroundColor: customColors[0] }} />
                    <div className="flex-1" style={{ backgroundColor: customColors[1] }} />
                    <div className="flex-1" style={{ backgroundColor: customColors[2] }} />
                    <div className="flex-[2]" style={{ backgroundColor: customColors[3] }} />
                  </div>
                </div>
              </div>
            )}

            {/* Upload reference image */}
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

          {/* Custom instructions */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              Instructions (optional)
            </label>
            <textarea
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              placeholder='Guide the white paper content — e.g. "Focus on market analysis and ROI" or "Emphasize the technical architecture"'
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
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="text-indigo-500 animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400">{progressMessage}</p>
            </div>
          )}

          {/* Generate button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate White Paper'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
