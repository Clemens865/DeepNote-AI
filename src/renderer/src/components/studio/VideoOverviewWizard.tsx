import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, Loader2, Check, Palette, Film, Music, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { IMAGE_MODELS, VEO_MODELS, VEO_RESOLUTIONS, type ImageModelId, type StyleInfluence, type VeoModelId, type VeoResolution } from '../../../../shared/types'

type VideoMode = 'overview' | 'music-video'
type NarrativeStyle = 'explain' | 'present' | 'storytell' | 'documentary'
type MoodMode = 'auto' | 'custom' | 'reference'

const STYLE_OPTIONS = [
  { id: 'neon-circuit', name: 'Neon Circuit', description: 'Purple & cyan neon glow, cyberpunk', colorPalette: ['#0a0a14', '#a855f7', '#22d3ee', '#e2e8f0'] },
  { id: 'glass-morph', name: 'Glass Morphism', description: 'Frosted glass panels, dark gradient', colorPalette: ['#0f172a', '#e2e8f0', '#818cf8', '#94a3b8'] },
  { id: 'gradient-mesh', name: 'Gradient Mesh', description: 'Pink-to-blue gradient, startup feel', colorPalette: ['#0c1222', '#ec4899', '#3b82f6', '#e2e8f0'] },
  { id: 'terminal-hacker', name: 'Terminal', description: 'Phosphor green, hacker aesthetic', colorPalette: ['#0a0f0a', '#22c55e', '#4ade80', '#d1fae5'] },
  { id: 'cosmic-dark', name: 'Cosmic Dark', description: 'Violet & rose nebula, starfield', colorPalette: ['#06060e', '#8b5cf6', '#f43f5e', '#e2e8f0'] },
  { id: 'arctic-frost', name: 'Arctic Frost', description: 'Ice blue & white, crystalline shapes', colorPalette: ['#0f1729', '#38bdf8', '#f8fafc', '#64748b'] },
]

const DURATION_OPTIONS = [
  { label: '1 min', value: 60 },
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
]

const NARRATIVE_STYLES: { id: NarrativeStyle; label: string; description: string }[] = [
  { id: 'explain', label: 'Explain', description: 'Clear, educational tone' },
  { id: 'present', label: 'Present', description: 'Direct, professional delivery' },
  { id: 'storytell', label: 'Storytell', description: 'Engaging narrative arc' },
  { id: 'documentary', label: 'Documentary', description: 'Factual, authoritative voice' },
]

interface VideoOverviewWizardProps {
  notebookId: string
  onComplete: (contentId: string) => void
  onClose: () => void
}

export function VideoOverviewWizard({ notebookId, onComplete, onClose }: VideoOverviewWizardProps) {
  const [step, setStep] = useState(1)

  // Step 1 — Mode
  const [mode, setMode] = useState<VideoMode>('overview')

  // Step 2 — Config
  const [targetDuration, setTargetDuration] = useState(180)
  const [narrativeStyle, setNarrativeStyle] = useState<NarrativeStyle>('explain')
  const [narrationEnabled, setNarrationEnabled] = useState(true)
  const [audioFilePath, setAudioFilePath] = useState<string | null>(null)
  const [lyricsText, setLyricsText] = useState('')

  // Step 3 — Mood & Style
  const [moodMode, setMoodMode] = useState<MoodMode>('auto')
  const [moodPrompt, setMoodPrompt] = useState('')
  const [referenceImagePath, setReferenceImagePath] = useState<string | null>(null)
  const [styleInfluence, setStyleInfluence] = useState<StyleInfluence>('style-mood')
  const [selectedStyle, setSelectedStyle] = useState('neon-circuit')
  const [imageModel, setImageModel] = useState<ImageModelId>('nano-banana-pro')
  const [veoModel, setVeoModel] = useState<VeoModelId>('veo-3.1-fast')
  const [veoResolution, setVeoResolution] = useState<VeoResolution>('720p')
  const [userInstructions, setUserInstructions] = useState('')
  const [customColors, setCustomColors] = useState(['#0a0a14', '#a855f7', '#22d3ee', '#e2e8f0'])
  const [customStyleDesc, setCustomStyleDesc] = useState('')

  // Progress state
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [generatedContentId, setGeneratedContentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Storyboard review state
  const [storyboardScenes, setStoryboardScenes] = useState<
    { sceneNumber: number; imagePath: string; narrationText: string; durationSec: number }[]
  >([])
  const [regeneratingScene, setRegeneratingScene] = useState<number | null>(null)
  const [regenInstruction, setRegenInstruction] = useState<Record<number, string>>({})
  const [showRegenInput, setShowRegenInput] = useState<number | null>(null)

  const updateCustomColor = useCallback((index: number, color: string) => {
    setCustomColors(prev => { const next = [...prev]; next[index] = color; return next })
  }, [])

  // Listen for progress events (both storyboard gen and animation phases)
  useEffect(() => {
    if (!isGenerating) return
    const cleanupProgress = window.api.onVideoOverviewProgress(
      (data: { generatedContentId: string; stage: string; message: string; currentScene?: number; totalScenes?: number }) => {
        if (generatedContentId && data.generatedContentId !== generatedContentId) return
        setProgressMessage(data.message)
      }
    )
    return () => { cleanupProgress() }
  }, [isGenerating, generatedContentId])

  // Listen for storyboard ready (step 4 → step 5)
  useEffect(() => {
    if (step !== 4) return
    const cleanup = window.api.onVideoOverviewStoryboardReady(
      (data: {
        generatedContentId: string
        scenes: { sceneNumber: number; imagePath: string; narrationText: string; durationSec: number }[]
        assetName: string
      }) => {
        if (generatedContentId && data.generatedContentId !== generatedContentId) return
        setStoryboardScenes(data.scenes)
        setIsGenerating(false)
        setStep(5)
      }
    )
    return () => { cleanup() }
  }, [step, generatedContentId])

  // Listen for final video complete (step 6)
  useEffect(() => {
    if (step !== 6) return
    const cleanup = window.api.onVideoOverviewComplete(
      (data: { generatedContentId: string; success: boolean; error?: string }) => {
        if (generatedContentId && data.generatedContentId !== generatedContentId) return
        if (data.success) {
          onComplete(data.generatedContentId)
        } else {
          setError(data.error || 'Animation failed')
          setIsGenerating(false)
        }
      }
    )
    return () => { cleanup() }
  }, [step, generatedContentId, onComplete])

  const handleUploadAudio = async () => {
    const filePath = await window.api.showOpenDialog({
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
    })
    if (filePath) setAudioFilePath(filePath)
  }

  const handleUploadReference = async () => {
    const filePath = await window.api.showOpenDialog({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    })
    if (filePath) {
      setReferenceImagePath(filePath)
      setMoodMode('reference')
    }
  }

  const handleGenerateStoryboard = async () => {
    setIsGenerating(true)
    setProgressMessage('Planning scenes and generating images...')
    setError(null)
    setStep(4)
    try {
      const result = await window.api.videoOverviewStart({
        notebookId,
        mode,
        targetDurationSec: targetDuration,
        narrativeStyle: mode === 'overview' ? narrativeStyle : undefined,
        narrationEnabled: mode === 'overview' ? narrationEnabled : false,
        moodMode,
        moodPrompt: moodMode === 'custom' ? moodPrompt.trim() || undefined : undefined,
        referenceImagePath: moodMode === 'reference' ? referenceImagePath ?? undefined : undefined,
        styleInfluence: referenceImagePath ? styleInfluence : undefined,
        stylePresetId: selectedStyle,
        imageModel,
        veoModel,
        veoResolution,
        audioFilePath: mode === 'music-video' ? audioFilePath ?? undefined : undefined,
        lyricsText: mode === 'music-video' && lyricsText.trim() ? lyricsText.trim() : undefined,
        userInstructions: userInstructions.trim() || undefined,
        ...(selectedStyle === 'custom-builder' ? {
          customStyleColors: customColors,
          customStyleDescription: customStyleDesc.trim() || 'modern, cinematic, professional',
        } : {}),
      })
      setGeneratedContentId(result.generatedContentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
      setIsGenerating(false)
    }
  }

  const handleRegenerateScene = async (sceneNumber: number) => {
    if (!generatedContentId) return
    setRegeneratingScene(sceneNumber)
    try {
      const result = await window.api.videoOverviewRegenScene({
        generatedContentId,
        sceneNumber,
        instruction: regenInstruction[sceneNumber]?.trim() || undefined,
      })
      setStoryboardScenes(prev =>
        prev.map(s => s.sceneNumber === sceneNumber ? { ...s, imagePath: result.imagePath } : s)
      )
      setShowRegenInput(null)
      setRegenInstruction(prev => { const next = { ...prev }; delete next[sceneNumber]; return next })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate scene')
    } finally {
      setRegeneratingScene(null)
    }
  }

  const handleAnimate = async () => {
    if (!generatedContentId) return
    setIsGenerating(true)
    setProgressMessage('Starting animation...')
    setError(null)
    setStep(6)
    try {
      await window.api.videoOverviewAnimate({ generatedContentId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start animation')
      setIsGenerating(false)
    }
  }

  const canProceedStep2 = mode === 'overview' || (mode === 'music-video' && audioFilePath)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/[0.06] w-full mx-4 max-h-[85vh] flex flex-col transition-all ${step === 5 ? 'max-w-2xl' : 'max-w-lg'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.04] shrink-0 rounded-t-2xl">
          <h2 className="font-bold text-zinc-800 dark:text-zinc-100">
            {step === 4 ? 'Generating Storyboard...' : step === 5 ? 'Storyboard Review' : step === 6 ? 'Animating Video...' : 'Video Overview'}
          </h2>
          <div className="flex items-center gap-2">
            {step <= 5 && step !== 4 && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Step {step}/{step <= 3 ? 3 : 5}</span>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Step 1: Mode Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 block">Choose Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('overview')}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    mode === 'overview'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300'
                  }`}
                >
                  <Film size={20} className={mode === 'overview' ? 'text-indigo-500' : 'text-zinc-400'} />
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-2">Video Overview</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">AI narrated explainer video from your sources.</p>
                </button>
                <button
                  onClick={() => setMode('music-video')}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    mode === 'music-video'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300'
                  }`}
                >
                  <Music size={20} className={mode === 'music-video' ? 'text-indigo-500' : 'text-zinc-400'} />
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-2">Music Video</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Upload audio; AI generates visuals synced to music.</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 2 && (
            <div className="space-y-4">
              {mode === 'overview' ? (
                <>
                  {/* Duration */}
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">Duration</label>
                    <div className="grid grid-cols-4 gap-2">
                      {DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setTargetDuration(opt.value)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            targetDuration === opt.value
                              ? 'bg-indigo-500 text-white'
                              : 'bg-black/[0.03] dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Narrative Style */}
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">Narrative Style</label>
                    <div className="grid grid-cols-2 gap-2">
                      {NARRATIVE_STYLES.map((ns) => (
                        <button
                          key={ns.id}
                          onClick={() => setNarrativeStyle(ns.id)}
                          className={`text-left p-2.5 rounded-xl border-2 transition-all ${
                            narrativeStyle === ns.id
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                              : 'border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300'
                          }`}
                        >
                          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{ns.label}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{ns.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Narration Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={narrationEnabled}
                      onChange={(e) => setNarrationEnabled(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">Enable AI narration</span>
                  </label>
                </>
              ) : (
                <>
                  {/* Audio Upload */}
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">Audio File</label>
                    <button
                      onClick={handleUploadAudio}
                      className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-black/[0.1] dark:border-white/[0.1] hover:border-indigo-400 transition-colors text-sm text-zinc-500 dark:text-zinc-400"
                    >
                      <Upload size={16} />
                      {audioFilePath ? audioFilePath.split('/').pop() : 'Upload MP3, WAV, OGG, or M4A'}
                    </button>
                    {audioFilePath && (
                      <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1">
                        <Check size={10} /> Audio loaded
                      </p>
                    )}
                  </div>

                  {/* Lyrics */}
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
                      Lyrics <span className="font-normal text-zinc-400">(optional)</span>
                    </label>
                    <textarea
                      value={lyricsText}
                      onChange={(e) => setLyricsText(e.target.value)}
                      placeholder="Paste lyrics to help AI sync visuals..."
                      rows={4}
                      className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-sm text-zinc-700 dark:text-zinc-200 px-3 py-2 outline-none focus:border-indigo-500/50 resize-none"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Mood & Style */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Mood Tabs */}
              <div>
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">Mood</label>
                <div className="flex gap-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-1">
                  {(['auto', 'custom', 'reference'] as MoodMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMoodMode(m)}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                        moodMode === m
                          ? 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-sm'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                    >
                      {m === 'reference' ? 'Image' : m}
                    </button>
                  ))}
                </div>

                {moodMode === 'custom' && (
                  <textarea
                    value={moodPrompt}
                    onChange={(e) => setMoodPrompt(e.target.value)}
                    placeholder="e.g., dreamy pastel watercolors with soft lighting..."
                    rows={2}
                    className="mt-2 w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-sm text-zinc-700 dark:text-zinc-200 px-3 py-2 outline-none focus:border-indigo-500/50 resize-none"
                  />
                )}

                {moodMode === 'reference' && (
                  <div className="mt-2 space-y-2">
                    <button
                      onClick={handleUploadReference}
                      className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-black/[0.1] dark:border-white/[0.1] hover:border-indigo-400 transition-colors text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      <Upload size={14} />
                      {referenceImagePath ? referenceImagePath.split('/').pop() : 'Upload reference image'}
                    </button>
                    {referenceImagePath && (
                      <>
                        <p className="text-[10px] text-green-500 flex items-center gap-1"><Check size={10} /> Reference loaded</p>
                        <div>
                          <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Style Influence</label>
                          <select
                            value={styleInfluence}
                            onChange={(e) => setStyleInfluence(e.target.value as StyleInfluence)}
                            className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-xs text-zinc-700 dark:text-zinc-200 px-2 py-1.5 outline-none"
                          >
                            <option value="style-only">Style Only</option>
                            <option value="style-mood">Style + Mood</option>
                            <option value="full-match">Full Match</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Style Presets */}
              <div>
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">Visual Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {STYLE_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStyle(s.id)}
                      className={`text-left p-2 rounded-xl border-2 transition-all ${
                        selectedStyle === s.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                          : 'border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex gap-0.5 mb-1.5">
                        {s.colorPalette.map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <p className="text-[10px] font-bold text-zinc-700 dark:text-zinc-200">{s.name}</p>
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedStyle('custom-builder')}
                    className={`text-left p-2 rounded-xl border-2 transition-all ${
                      selectedStyle === 'custom-builder'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300'
                    }`}
                  >
                    <Palette size={14} className="text-zinc-400 mb-1" />
                    <p className="text-[10px] font-bold text-zinc-700 dark:text-zinc-200">Custom</p>
                  </button>
                </div>
              </div>

              {/* Custom Style Builder */}
              {selectedStyle === 'custom-builder' && (
                <div className="space-y-2 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06]">
                  <div className="grid grid-cols-4 gap-2">
                    {['Background', 'Primary', 'Accent', 'Text'].map((label, i) => (
                      <div key={label}>
                        <p className="text-[9px] text-zinc-500 mb-1">{label}</p>
                        <input
                          type="color"
                          value={customColors[i]}
                          onChange={(e) => updateCustomColor(i, e.target.value)}
                          className="w-full h-7 rounded cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={customStyleDesc}
                    onChange={(e) => setCustomStyleDesc(e.target.value)}
                    placeholder="Describe your visual style..."
                    rows={2}
                    className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-200 px-2 py-1.5 outline-none resize-none"
                  />
                </div>
              )}

              {/* Image Model */}
              <div>
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Image Model</label>
                <select
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value as ImageModelId)}
                  className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-xs text-zinc-700 dark:text-zinc-200 px-2 py-1.5 outline-none"
                >
                  {IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Video Model + Resolution */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Video Model</label>
                  <select
                    value={veoModel}
                    onChange={(e) => {
                      const newModel = e.target.value as VeoModelId
                      setVeoModel(newModel)
                      // Reset resolution if not supported by new model
                      const supported = VEO_RESOLUTIONS.filter(r => r.models.includes(newModel))
                      if (!supported.find(r => r.id === veoResolution)) {
                        setVeoResolution(supported[0]?.id || '720p')
                      }
                    }}
                    className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-xs text-zinc-700 dark:text-zinc-200 px-2 py-1.5 outline-none"
                  >
                    {VEO_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-zinc-400 mt-0.5">{VEO_MODELS.find(m => m.id === veoModel)?.description}</p>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Resolution</label>
                  <div className="flex gap-1.5">
                    {VEO_RESOLUTIONS.filter(r => r.models.includes(veoModel)).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setVeoResolution(r.id)}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                          veoResolution === r.id
                            ? 'bg-indigo-500 text-white'
                            : 'bg-black/[0.03] dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-0.5">{VEO_RESOLUTIONS.find(r => r.id === veoResolution)?.note}</p>
                </div>
              </div>

              {/* User Instructions */}
              <div>
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">
                  Extra Instructions <span className="font-normal text-zinc-400">(optional)</span>
                </label>
                <textarea
                  value={userInstructions}
                  onChange={(e) => setUserInstructions(e.target.value)}
                  placeholder="Any specific directions for the AI..."
                  rows={2}
                  className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-xs text-zinc-700 dark:text-zinc-200 px-3 py-2 outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 4: Storyboard Generation Progress */}
          {step === 4 && (
            <div className="space-y-4 py-4">
              {error ? (
                <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-4">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">Generation Failed</p>
                  <p className="text-xs text-red-500 dark:text-red-400/80 mt-1">{error}</p>
                  <button
                    onClick={() => { setError(null); setIsGenerating(false); setStep(3) }}
                    className="mt-3 px-3 py-1.5 text-xs rounded-lg bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 transition-colors"
                  >
                    Go Back
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {progressMessage || 'Planning scenes...'}
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                      Generating storyboard images — this may take a few minutes.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Storyboard Review */}
          {step === 5 && (
            <div className="space-y-4">
              {error && (
                <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-3">
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                  <button onClick={() => setError(null)} className="mt-1 text-[10px] text-red-500 underline">Dismiss</button>
                </div>
              )}
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Review your storyboard. Click regenerate on any scene to change its image before animating.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {storyboardScenes.map((scene) => (
                  <div
                    key={scene.sceneNumber}
                    className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] overflow-hidden bg-black/[0.01] dark:bg-white/[0.01]"
                  >
                    <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
                      {regeneratingScene === scene.sceneNumber ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 size={20} className="animate-spin text-indigo-500" />
                        </div>
                      ) : (
                        <img
                          src={`local-file://${scene.imagePath}`}
                          alt={`Scene ${scene.sceneNumber}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 text-white">
                        #{scene.sceneNumber} · {scene.durationSec}s
                      </span>
                    </div>
                    <div className="p-2.5 space-y-2">
                      <p className="text-[10px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {scene.narrationText || '(no narration)'}
                      </p>
                      {showRegenInput === scene.sceneNumber ? (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={regenInstruction[scene.sceneNumber] || ''}
                            onChange={(e) => setRegenInstruction(prev => ({ ...prev, [scene.sceneNumber]: e.target.value }))}
                            placeholder="Optional: describe changes..."
                            className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-zinc-800 text-[10px] text-zinc-700 dark:text-zinc-200 px-2 py-1.5 outline-none"
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleRegenerateScene(scene.sceneNumber)}
                              disabled={regeneratingScene !== null}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                              <RefreshCw size={10} /> Regenerate
                            </button>
                            <button
                              onClick={() => setShowRegenInput(null)}
                              className="px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowRegenInput(scene.sceneNumber)}
                          disabled={regeneratingScene !== null}
                          className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-600 disabled:opacity-50 font-medium"
                        >
                          <RefreshCw size={10} /> Regenerate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 6: Animation Progress */}
          {step === 6 && (
            <div className="space-y-4 py-4">
              {error ? (
                <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-4">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">Animation Failed</p>
                  <p className="text-xs text-red-500 dark:text-red-400/80 mt-1">{error}</p>
                  <button
                    onClick={() => { setError(null); setIsGenerating(false); setStep(5) }}
                    className="mt-3 px-3 py-1.5 text-xs rounded-lg bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 transition-colors"
                  >
                    Back to Storyboard
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {progressMessage || 'Starting animation...'}
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                      Animating scenes and assembling video — this may take several minutes.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — navigation */}
        {(step <= 3 || step === 5) && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-black/[0.06] dark:border-white/[0.04] shrink-0">
            <button
              onClick={() => step > 1 && step <= 3 ? setStep(step - 1) : step === 5 ? setStep(3) : onClose()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <ChevronLeft size={14} />
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 2 && !canProceedStep2}
                className="flex items-center gap-1 px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={14} />
              </button>
            ) : step === 3 ? (
              <button
                onClick={handleGenerateStoryboard}
                className="flex items-center gap-1 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Generate Storyboard
              </button>
            ) : (
              <button
                onClick={handleAnimate}
                disabled={regeneratingScene !== null}
                className="flex items-center gap-1 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Film size={14} />
                Animate Video
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
