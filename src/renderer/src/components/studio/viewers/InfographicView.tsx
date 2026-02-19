import { Download } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface KeyPoint {
  heading: string
  body: string
  visualDescription: string
}

interface InfographicPlan {
  title: string
  subtitle: string
  keyPoints: KeyPoint[]
  colorScheme?: string
}

interface InfographicViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

function InfographicOverlay({ plan, imagePath }: { plan: InfographicPlan | null; imagePath: string }) {
  if (!plan) {
    // Fallback: just show the image if no plan data
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
      {/* Background image */}
      <img
        src={`local-file://${imagePath}`}
        alt="Infographic background"
        className="w-full h-auto"
      />

      {/* Overlay with plan data */}
      <div className="absolute inset-0 flex flex-col p-6 sm:p-10"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.55) 100%)' }}
      >
        {/* Title area */}
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg leading-tight">
            {plan.title}
          </h2>
          {plan.subtitle && (
            <p className="text-sm sm:text-base text-white/80 mt-1.5 drop-shadow">
              {plan.subtitle}
            </p>
          )}
        </div>

        {/* Key points grid */}
        <div className="flex-1 grid grid-cols-2 gap-3 sm:gap-4 auto-rows-fr">
          {plan.keyPoints.map((kp, i) => (
            <div
              key={i}
              className="rounded-xl p-3 sm:p-4 flex flex-col justify-center"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
            >
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center text-white/90 text-xs font-bold mt-0.5">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-white leading-snug">
                    {kp.heading}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/75 mt-1 leading-relaxed">
                    {kp.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function InfographicContent({ data }: { data: Record<string, unknown> }) {
  const imagePath = data.imagePath as string | undefined
  const plan = (data.plan as InfographicPlan | undefined) || null

  if (!imagePath) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No infographic generated yet.</p>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
        <InfographicOverlay plan={plan} imagePath={imagePath} />
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => window.api.studioSaveFile({ sourcePath: imagePath, defaultName: 'infographic.png' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <Download size={12} />
          Download background image
        </button>
      </div>
    </div>
  )
}

export function InfographicView({ data, isFullscreen, onCloseFullscreen, title }: InfographicViewProps) {
  const imagePath = data.imagePath as string | undefined
  const plan = (data.plan as InfographicPlan | undefined) || null

  const downloadAction = imagePath ? (
    <button
      onClick={() => window.api.studioSaveFile({ sourcePath: imagePath, defaultName: 'infographic.png' })}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
      title="Download background image"
    >
      <Download size={16} />
    </button>
  ) : undefined

  return (
    <>
      <InfographicContent data={data} />
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
              <InfographicOverlay plan={plan} imagePath={imagePath} />
            </div>
          </div>
        )}
      </FullscreenWrapper>
    </>
  )
}
