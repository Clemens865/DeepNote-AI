import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, Loader2, Check, Palette, FileUp } from 'lucide-react'
import type { StyleInfluence } from '../../../../shared/types'

interface StylePreset {
  id: string
  name: string
  description: string
  colorPalette: string[]
}

const STYLE_PRESETS: StylePreset[] = [
  { id: 'midnight-indigo', name: 'Midnight Indigo', description: 'Deep dark + indigo/purple', colorPalette: ['#050510', '#6366f1', '#a855f7', '#ec4899', '#818cf8'] },
  { id: 'sunset-gradient', name: 'Sunset Gradient', description: 'Warm oranges/reds/amber', colorPalette: ['#0f0a05', '#f97316', '#ef4444', '#f59e0b', '#fbbf24'] },
  { id: 'ocean-depths', name: 'Ocean Depths', description: 'Deep blues/teals', colorPalette: ['#020817', '#0ea5e9', '#06b6d4', '#2563eb', '#38bdf8'] },
  { id: 'neon-cyber', name: 'Neon Cyber', description: 'Bright cyan/magenta, cyberpunk', colorPalette: ['#0a0a0a', '#22d3ee', '#d946ef', '#06b6d4', '#e879f9'] },
  { id: 'forest-canopy', name: 'Forest Canopy', description: 'Deep greens/earth tones', colorPalette: ['#050f0a', '#22c55e', '#16a34a', '#84cc16', '#4ade80'] },
  { id: 'arctic-frost', name: 'Arctic Frost', description: 'Icy blues/whites on dark slate', colorPalette: ['#0f1729', '#38bdf8', '#e2e8f0', '#7dd3fc', '#94a3b8'] },
  { id: 'corporate-clean', name: 'Corporate Clean', description: 'Professional navy/blue', colorPalette: ['#0f172a', '#3b82f6', '#64748b', '#1e40af', '#f1f5f9'] },
  { id: 'startup-fresh', name: 'Startup Fresh', description: 'Vibrant lime/teal/yellow', colorPalette: ['#0a0f0a', '#84cc16', '#14b8a6', '#facc15', '#a3e635'] },
  { id: 'academic-classic', name: 'Academic Classic', description: 'Warm ivory/burgundy/gold', colorPalette: ['#1a1410', '#b45309', '#991b1b', '#d97706', '#fef3c7'] },
  { id: 'tech-dark', name: 'Tech Dark', description: 'Matrix green/terminal black', colorPalette: ['#030712', '#10b981', '#059669', '#34d399', '#6ee7b7'] },
  { id: 'warm-earth', name: 'Warm Earth', description: 'Terracotta/amber/sand', colorPalette: ['#1c1210', '#c2410c', '#ea580c', '#d97706', '#fde68a'] },
  { id: 'pastel-dream', name: 'Pastel Dream', description: 'Soft pastels on deep slate', colorPalette: ['#0f0d1a', '#c084fc', '#f9a8d4', '#93c5fd', '#fde68a'] },
]

interface HtmlPresentationWizardProps {
  notebookId: string
  onComplete: (contentId: string) => void
  onClose: () => void
}

export function HtmlPresentationWizard({ notebookId, onComplete, onClose }: HtmlPresentationWizardProps) {
  const [selectedStyle, setSelectedStyle] = useState('midnight-indigo')
  const [customStylePath, setCustomStylePath] = useState<string | null>(null)
  const [styleInfluence, setStyleInfluence] = useState<StyleInfluence>('style-mood')
  const [model, setModel] = useState<'flash' | 'pro'>('flash')
  const [userInstructions, setUserInstructions] = useState('')
  const [outputMode, setOutputMode] = useState<'html' | 'pptx'>('html')
  const [pptxTemplatePath, setPptxTemplatePath] = useState<string | null>(null)
  const [templateColors, setTemplateColors] = useState<string[] | null>(null)
  const [templateFonts, setTemplateFonts] = useState<string | null>(null)
  const [templateAssetSummary, setTemplateAssetSummary] = useState<string | null>(null)

  // Custom style builder state
  const [customColors, setCustomColors] = useState(['#050510', '#6366f1', '#a855f7', '#e2e8f0'])
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

    const cleanupProgress = window.api.onHtmlPresentationProgress(
      (data: { generatedContentId: string; stage: string; message: string }) => {
        if (generatedContentId && data.generatedContentId !== generatedContentId) return
        setProgressMessage(data.message)
      }
    )

    const cleanupComplete = window.api.onHtmlPresentationComplete(
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

  const handleUploadTemplate = async () => {
    const filePath = await window.api.showOpenDialog({
      filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
    })
    if (filePath) {
      try {
        const theme = await window.api.htmlPresentationParseTemplate({ filePath })
        setPptxTemplatePath(filePath)
        const colors = theme.colors
        setTemplateColors([colors.accent1, colors.accent2, colors.accent3])
        setTemplateFonts(`${theme.fonts.heading} / ${theme.fonts.body}`)
        // Summarize extracted assets
        const assets = theme.pptxTemplate?.assets || []
        const parts: string[] = []
        if (theme.pptxTemplate?.backgroundImageBase64) parts.push('background image')
        const logoCount = assets.filter(a => a.role === 'logo').length
        const decoCount = assets.filter(a => a.role === 'decoration').length
        if (logoCount) parts.push(`${logoCount} logo${logoCount > 1 ? 's' : ''}`)
        if (decoCount) parts.push(`${decoCount} decoration${decoCount > 1 ? 's' : ''}`)
        const mediaCount = theme.pptxTemplate?.mediaFileCount || 0
        if (mediaCount > 0 && parts.length === 0) parts.push(`${mediaCount} media file${mediaCount > 1 ? 's' : ''} found`)
        setTemplateAssetSummary(parts.length ? `Extracted: ${parts.join(', ')}` : 'No embedded images found in template')
      } catch {
        setError('Failed to parse template file')
      }
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setProgressMessage('Starting generation...')
    setError(null)

    try {
      const result = await window.api.htmlPresentationStart({
        notebookId,
        model,
        outputMode,
        stylePresetId: selectedStyle === 'custom' ? 'midnight-indigo' : selectedStyle,
        pptxTemplatePath: pptxTemplatePath ?? undefined,
        userInstructions: userInstructions.trim() || undefined,
        customStyleImagePath: customStylePath ?? undefined,
        styleInfluence: customStylePath ? styleInfluence : undefined,
        ...(selectedStyle === 'custom-builder' ? {
          customStyleColors: customColors,
          customStyleDescription: customStyleDesc.trim() || 'modern, professional, cinematic presentation with smooth animations',
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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/[0.06] w-full max-w-xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.04] shrink-0 rounded-t-2xl">
          <h2 className="font-bold text-zinc-800 dark:text-zinc-100">Create Presentation</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Output Mode Toggle */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Output Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOutputMode('html')}
                className={`text-left p-2.5 rounded-lg border-2 transition-all ${
                  outputMode === 'html'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                    : 'border-black/[0.06] dark:border-white/[0.06] hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">HTML Web Deck</span>
                  {outputMode === 'html' && <Check size={14} className="text-indigo-500" />}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Animated web presentation with effects</p>
              </button>
              <button
                onClick={() => setOutputMode('pptx')}
                className={`text-left p-2.5 rounded-lg border-2 transition-all ${
                  outputMode === 'pptx'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                    : 'border-black/[0.06] dark:border-white/[0.06] hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">PowerPoint (.pptx)</span>
                  {outputMode === 'pptx' && <Check size={14} className="text-indigo-500" />}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Opens in PowerPoint / Keynote</p>
              </button>
            </div>
          </div>

          {/* PPTX Template Upload (only in PPTX mode) */}
          {outputMode === 'pptx' && (
            <div>
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
                Company Template (optional)
              </label>
              <button
                onClick={handleUploadTemplate}
                className={`w-full text-left p-2.5 rounded-lg border-2 transition-all flex items-center gap-2 ${
                  pptxTemplatePath
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                    : 'border-dashed border-black/[0.08] dark:border-white/[0.08] hover:border-zinc-400'
                }`}
              >
                <FileUp size={14} className="text-zinc-400 flex-shrink-0" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {pptxTemplatePath ? 'Template loaded' : 'Upload a .pptx template to extract theme'}
                </span>
              </button>
              {templateColors && (
                <div className="mt-2 p-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {templateColors.map((c, i) => (
                        <div key={i} className="w-5 h-5 rounded border border-black/[0.06] dark:border-white/[0.06]" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    {templateFonts && <span className="text-[10px] text-zinc-400">{templateFonts}</span>}
                  </div>
                  {templateAssetSummary && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{templateAssetSummary}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Style Presets */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Color Theme
            </label>
            <div className="grid grid-cols-4 gap-2">
              {STYLE_PRESETS.map((style) => (
                <button
                  key={style.id}
                  onClick={() => { setSelectedStyle(style.id); setCustomStylePath(null) }}
                  className={`text-left p-1.5 rounded-lg border-2 transition-all ${
                    selectedStyle === style.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-black/[0.06] dark:border-white/[0.06] hover:border-zinc-300'
                  }`}
                >
                  <div className="flex gap-0.5 mb-1">
                    {style.colorPalette.slice(0, 4).map((color, ci) => (
                      <div key={ci} className="w-3 h-3 rounded-sm border border-black/[0.06] dark:border-white/[0.06]" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-200 leading-tight block">{style.name}</span>
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
                Create your own color theme
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
                    </div>
                  ))}
                </div>
                <input
                  type="text"
                  value={customStyleDesc}
                  onChange={(e) => setCustomStyleDesc(e.target.value)}
                  placeholder="e.g. minimalist, corporate, playful, retro..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-400"
                />
              </div>
            )}

            {/* Upload reference image */}
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

          {/* AI Model */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              AI Model
            </label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'flash' as const, name: 'Flash', desc: 'Fast generation (~15s)' },
                { id: 'pro' as const, name: 'Pro', desc: 'Premium quality (~45s)' },
              ]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`text-left p-2.5 rounded-xl border-2 transition-all ${
                    model === m.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-black/[0.06] dark:border-white/[0.06] hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{m.name}</span>
                    {model === m.id && <Check size={14} className="text-indigo-500" />}
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              Instructions (optional)
            </label>
            <textarea
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              placeholder='e.g. "Executive summary with statistics" or "Technical deep-dive"'
              rows={2}
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
              {isGenerating ? 'Generating...' : `Generate ${outputMode === 'pptx' ? 'PowerPoint' : 'Presentation'}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
