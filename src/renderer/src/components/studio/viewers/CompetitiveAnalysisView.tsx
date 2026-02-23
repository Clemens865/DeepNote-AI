import { FullscreenWrapper } from './FullscreenWrapper'

interface CompetitiveAnalysisViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

interface Competitor {
  name: string
  scores: Record<string, number>
  strengths?: string[]
  weaknesses?: string[]
}

interface Feature {
  name: string
  weight?: number
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
    : score >= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
    : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'

  return (
    <span className={`inline-block text-xs font-bold rounded px-2 py-0.5 min-w-[28px] text-center ${color}`}>
      {score}
    </span>
  )
}

function CompetitiveAnalysisContent({ data }: { data: Record<string, unknown> }) {
  const analysisTitle = data.title as string | undefined
  const summary = data.summary as string | undefined
  const competitors = (data.competitors as Competitor[]) || []
  const features = (data.features as Feature[]) || []
  const recommendation = data.recommendation as string | undefined

  return (
    <div className="space-y-5">
      {analysisTitle && <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">{analysisTitle}</h3>}

      {summary && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{summary}</p>
      )}

      {/* Feature comparison matrix */}
      {competitors.length > 0 && features.length > 0 && (
        <div className="overflow-auto rounded-xl border border-black/[0.06] dark:border-white/[0.06]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-black/[0.02] dark:bg-white/[0.02]">
                <th className="px-3 py-2 text-left font-semibold text-zinc-600 dark:text-zinc-300 border-b border-black/[0.06] dark:border-white/[0.06] sticky left-0 bg-black/[0.02] dark:bg-white/[0.02]">
                  Feature
                </th>
                {competitors.map((comp, i) => (
                  <th key={i} className="px-3 py-2 text-center font-semibold text-zinc-600 dark:text-zinc-300 border-b border-black/[0.06] dark:border-white/[0.06]">
                    {comp.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature, fi) => (
                <tr key={fi} className="border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0">
                  <td className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300 sticky left-0 bg-white dark:bg-zinc-900">
                    {feature.name}
                  </td>
                  {competitors.map((comp, ci) => (
                    <td key={ci} className="px-3 py-2 text-center">
                      <ScoreBadge score={comp.scores[feature.name] ?? 0} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-black/[0.02] dark:bg-white/[0.02]">
                <td className="px-3 py-2 font-bold text-zinc-800 dark:text-zinc-200 sticky left-0 bg-black/[0.02] dark:bg-white/[0.02]">
                  Overall
                </td>
                {competitors.map((comp, ci) => {
                  const avg = features.length > 0
                    ? features.reduce((sum, f) => sum + (comp.scores[f.name] ?? 0), 0) / features.length
                    : 0
                  return (
                    <td key={ci} className="px-3 py-2 text-center">
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{avg.toFixed(1)}</span>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {competitors.some(c => c.strengths || c.weaknesses) && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(competitors.length, 3)}, 1fr)` }}>
          {competitors.map((comp, i) => (
            <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-4">
              <h5 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2">{comp.name}</h5>
              {comp.strengths && comp.strengths.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Strengths</p>
                  <ul className="space-y-0.5">
                    {comp.strengths.map((s, si) => (
                      <li key={si} className="text-xs text-zinc-600 dark:text-zinc-400 flex gap-1">
                        <span className="text-emerald-500 flex-shrink-0">+</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {comp.weaknesses && comp.weaknesses.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase mb-1">Weaknesses</p>
                  <ul className="space-y-0.5">
                    {comp.weaknesses.map((w, wi) => (
                      <li key={wi} className="text-xs text-zinc-600 dark:text-zinc-400 flex gap-1">
                        <span className="text-red-500 flex-shrink-0">-</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {recommendation && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-4 border border-indigo-200 dark:border-indigo-500/20">
          <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide mb-1">Recommendation</h4>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{recommendation}</p>
        </div>
      )}
    </div>
  )
}

export function CompetitiveAnalysisView({ data, isFullscreen, onCloseFullscreen, title }: CompetitiveAnalysisViewProps) {
  return (
    <>
      <CompetitiveAnalysisContent data={data} />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title} wide>
        <CompetitiveAnalysisContent data={data} />
      </FullscreenWrapper>
    </>
  )
}
