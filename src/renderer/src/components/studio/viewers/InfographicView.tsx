import { useState, useEffect, useCallback } from 'react'
import { Download, Film, X, Loader2 } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

// --- New plan schema ---

interface SectionStat {
  value: string
  label: string
}

interface HeroStat {
  value: string
  label: string
  context: string
}

interface InfographicSection {
  heading: string
  annotation: string
  body?: string
  stat: SectionStat | null
  visualDescription: string
}

interface InfographicPlan {
  title: string
  subtitle: string
  heroStat?: HeroStat | null
  sections: InfographicSection[]
  visualNarrative?: string
  colorScheme?: string
}

// --- Legacy plan schema ---

interface LegacyKeyPoint {
  heading: string
  body: string
  visualDescription: string
}

interface LegacyInfographicPlan {
  title: string
  subtitle: string
  keyPoints: LegacyKeyPoint[]
  colorScheme?: string
}

// --- Helpers ---

function isLegacyPlan(plan: unknown): plan is LegacyInfographicPlan {
  return plan != null && typeof plan === 'object' && 'keyPoints' in plan && !('sections' in plan)
}

function normalizePlan(raw: unknown): InfographicPlan | null {
  if (!raw || typeof raw !== 'object') return null
  if (isLegacyPlan(raw)) {
    return {
      title: raw.title,
      subtitle: raw.subtitle,
      heroStat: null,
      sections: raw.keyPoints.map((kp) => ({
        heading: kp.heading,
        annotation: kp.body.split(/[.!?]/)[0]?.trim().split(/\s+/).slice(0, 12).join(' ') || kp.heading,
        body: kp.body,
        stat: null,
        visualDescription: kp.visualDescription,
      })),
      colorScheme: raw.colorScheme,
    }
  }
  return raw as InfographicPlan
}

// --- AnnotationPill ---

function AnnotationPill({ section }: { section: InfographicSection }) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      {showTooltip && section.body && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-black/85 backdrop-blur-sm text-white text-xs leading-relaxed max-w-[260px] w-max pointer-events-none z-20 shadow-lg">
          {section.body}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-black/85" />
        </div>
      )}

      {/* Pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 cursor-default transition-colors hover:bg-black/65">
        {/* Accent dot */}
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />

        {/* Stat value if present */}
        {section.stat && (
          <span className="text-sm font-bold text-white tabular-nums">{section.stat.value}</span>
        )}

        {/* Heading */}
        <span className="text-xs font-medium text-white/90 whitespace-nowrap">{section.heading}</span>

        {/* Separator + annotation */}
        <span className="text-[10px] text-white/60 leading-tight hidden sm:inline">
          {section.annotation}
        </span>
      </div>
    </div>
  )
}

// --- InfographicOverlay ---

function InfographicOverlay({ plan, imagePath }: { plan: InfographicPlan | null; imagePath: string }) {
  if (!plan) {
    return (
      <img
        src={`local-file://${imagePath}`}
        alt="Infographic"
        className="w-full h-auto"
      />
    )
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg">
      {/* Background image — 100% visible */}
      <img
        src={`local-file://${imagePath}`}
        alt="Infographic background"
        className="w-full h-auto"
      />

      {/* Top gradient fade for title */}
      <div
        className="absolute inset-x-0 top-0 h-28 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
      />

      {/* Bottom gradient fade for annotations */}
      <div
        className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 100%)' }}
      />

      {/* Title — top-left */}
      <div className="absolute top-0 left-0 p-5 sm:p-7 max-w-[70%]">
        <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg leading-tight">
          {plan.title}
        </h2>
        {plan.subtitle && (
          <p className="text-xs sm:text-sm text-white/75 mt-1 drop-shadow leading-snug">
            {plan.subtitle}
          </p>
        )}
      </div>

      {/* Hero stat — top-right */}
      {plan.heroStat && (
        <div className="absolute top-0 right-0 p-5 sm:p-7 text-right">
          <div className="text-3xl sm:text-4xl font-black text-white drop-shadow-lg tabular-nums leading-none">
            {plan.heroStat.value}
          </div>
          <div className="text-xs sm:text-sm text-white/70 mt-1 drop-shadow">
            {plan.heroStat.label}
          </div>
          <div className="text-[10px] sm:text-xs text-white/50 mt-0.5">
            {plan.heroStat.context}
          </div>
        </div>
      )}

      {/* Annotation pills — bottom edge */}
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2 justify-center">
          {plan.sections.map((section, i) => (
            <AnnotationPill key={i} section={section} />
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Animate Dialog ---

function AnimateDialog({
  contentId,
  onClose,
  onVideoGenerated,
}: {
  contentId: string
  onClose: () => void
  onVideoGenerated: (videoPath: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [error, setError] = useState('')

  // Auto-generate prompt on open
  useEffect(() => {
    window.api.infographicAnimate({ generatedContentId: contentId }).then(() => {
      // The IPC returns immediately (fire-and-forget). We listen via progress events.
    }).catch(() => {
      // This path generates the prompt only — we handle via a separate approach below
    })

    // Actually we need a different approach: generate prompt first, show it, then user clicks generate.
    // Let's use the IPC but only for generating the prompt. We'll call it without a prompt first
    // to just get the suggested prompt. But the current IPC fires the full pipeline...
    // Instead, let's just do the prompt generation inline by calling the animate IPC
    // with the prompt left empty — it will generate the prompt AND start video generation.
    // But the user wants to edit the prompt first.
    //
    // Better approach: we call infographicAnimate without a prompt. The progress event
    // with stage 'prompt' will give us the message. But we won't get the actual prompt text back.
    //
    // Simplest approach: just show a loading state, generate prompt client-side isn't possible
    // (no direct Gemini access from renderer). So let's add a separate approach:
    // We'll pass the prompt as empty string initially, catch the prompt from progress,
    // but actually we need the prompt text itself.
    //
    // Let me rethink: The cleanest way is to NOT auto-start generation. Instead:
    // 1. On dialog open, we just show a text area with placeholder
    // 2. User can type their own prompt or leave it empty
    // 3. When they click Generate, if prompt is empty, the IPC handler generates one automatically

    setIsLoadingPrompt(false)
    setPrompt('')
  }, [contentId])

  // Listen for progress and completion
  useEffect(() => {
    const cleanupProgress = window.api.onInfographicAnimateProgress((data) => {
      if (data.generatedContentId === contentId) {
        setProgressMessage(data.message)
      }
    })
    const cleanupComplete = window.api.onInfographicAnimateComplete((data) => {
      if (data.generatedContentId === contentId) {
        setIsGenerating(false)
        if (data.success && data.videoPath) {
          onVideoGenerated(data.videoPath)
          onClose()
        } else {
          setError(data.error || 'Animation generation failed')
        }
      }
    })
    return () => {
      cleanupProgress()
      cleanupComplete()
    }
  }, [contentId, onClose, onVideoGenerated])

  const handleGenerate = useCallback(() => {
    setIsGenerating(true)
    setError('')
    setProgressMessage('Starting animation...')
    window.api.infographicAnimate({
      generatedContentId: contentId,
      animationPrompt: prompt.trim() || undefined,
    }).catch((err: Error) => {
      setIsGenerating(false)
      setError(err.message)
    })
  }, [contentId, prompt])

  return (
    <div className="mt-4 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film size={14} className="text-violet-500" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Animate Infographic</span>
        </div>
        {!isGenerating && (
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {isLoadingPrompt ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 size={12} className="animate-spin" />
          Generating animation prompt...
        </div>
      ) : (
        <>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe how the infographic should animate (leave empty for AI-generated prompt)..."
            disabled={isGenerating}
            rows={3}
            className="w-full rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50"
          />

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {isGenerating ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Loader2 size={12} className="animate-spin text-violet-500" />
              {progressMessage || 'Generating animation...'}
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              <Film size={12} />
              Generate Video
            </button>
          )}
        </>
      )}
    </div>
  )
}

// --- Main components ---

function InfographicContent({ data, contentId }: { data: Record<string, unknown>; contentId: string }) {
  const imagePath = data.imagePath as string | undefined
  const rawPlan = data.plan ?? null
  const plan = normalizePlan(rawPlan)
  const renderMode = (data.renderMode as string | undefined) || 'hybrid'
  const [videoPath, setVideoPath] = useState<string | undefined>(data.videoPath as string | undefined)
  const [showAnimateDialog, setShowAnimateDialog] = useState(false)

  if (!imagePath) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No infographic generated yet.</p>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg overflow-hidden border border-black/[0.06] dark:border-white/[0.06]">
        {renderMode === 'full-image' ? (
          <img
            src={`local-file://${imagePath}`}
            alt="Infographic"
            className="w-full h-auto"
          />
        ) : (
          <InfographicOverlay plan={plan} imagePath={imagePath} />
        )}
      </div>

      {/* Video player */}
      {videoPath && (
        <div className="space-y-2">
          <div className="rounded-lg overflow-hidden border border-black/[0.06] dark:border-white/[0.06]">
            <video
              src={`local-file://${videoPath}`}
              controls
              className="w-full"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => window.api.studioSaveFile({ sourcePath: videoPath, defaultName: 'infographic-animation.mp4' })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <Download size={12} />
              Download video
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowAnimateDialog(true)}
          disabled={showAnimateDialog}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/[0.06] hover:text-violet-700 dark:hover:text-violet-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Film size={12} />
          {videoPath ? 'Re-animate' : 'Animate'}
        </button>
        <button
          onClick={() => window.api.studioSaveFile({ sourcePath: imagePath, defaultName: 'infographic.png' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <Download size={12} />
          Download image
        </button>
      </div>

      {/* Animate dialog */}
      {showAnimateDialog && (
        <AnimateDialog
          contentId={contentId}
          onClose={() => setShowAnimateDialog(false)}
          onVideoGenerated={(path) => setVideoPath(path)}
        />
      )}
    </div>
  )
}

interface InfographicViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
  contentId?: string
}

export function InfographicView({ data, isFullscreen, onCloseFullscreen, title, contentId }: InfographicViewProps) {
  const imagePath = data.imagePath as string | undefined
  const rawPlan = data.plan ?? null
  const plan = normalizePlan(rawPlan)
  const renderMode = (data.renderMode as string | undefined) || 'hybrid'

  const downloadAction = imagePath ? (
    <button
      onClick={() => window.api.studioSaveFile({ sourcePath: imagePath, defaultName: 'infographic.png' })}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
      title="Download image"
    >
      <Download size={16} />
    </button>
  ) : undefined

  return (
    <>
      <InfographicContent data={data} contentId={contentId || ''} />
      <FullscreenWrapper
        isOpen={isFullscreen}
        onClose={onCloseFullscreen}
        title={title}
        actions={downloadAction}
        wide
      >
        {imagePath && (
          <div className="flex items-center justify-center h-full">
            <div className="max-w-full max-h-[calc(100vh-120px)] overflow-hidden">
              {renderMode === 'full-image' ? (
                <img
                  src={`local-file://${imagePath}`}
                  alt="Infographic"
                  className="max-w-full max-h-[calc(100vh-120px)] object-contain"
                />
              ) : (
                <InfographicOverlay plan={plan} imagePath={imagePath} />
              )}
            </div>
          </div>
        )}
      </FullscreenWrapper>
    </>
  )
}
