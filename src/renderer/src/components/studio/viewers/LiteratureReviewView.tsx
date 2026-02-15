import { FullscreenWrapper } from './FullscreenWrapper'

interface LiteratureReviewViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

interface Theme {
  name: string
  sources: string[]
  summary: string
}

interface MethodRow {
  [key: string]: string
}

function LiteratureReviewContent({ data }: { data: Record<string, unknown> }) {
  const reviewTitle = data.title as string | undefined
  const overview = data.overview as string | undefined
  const themes = (data.themes as Theme[]) || []
  const methodologyComparison = data.methodologyComparison as { columns: string[]; rows: MethodRow[] } | undefined
  const gaps = (data.gaps as string[]) || []
  const recommendations = (data.recommendations as string[]) || []

  return (
    <div className="space-y-5">
      {reviewTitle && <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{reviewTitle}</h3>}

      {overview && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-4 border border-indigo-200 dark:border-indigo-500/20">
          <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide mb-1">Overview</h4>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{overview}</p>
        </div>
      )}

      {themes.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Key Themes</h4>
          {themes.map((theme, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{theme.name}</h5>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{theme.summary}</p>
              <div className="flex flex-wrap gap-1">
                {theme.sources.map((src, si) => (
                  <span key={si} className="text-[9px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded px-2 py-0.5">
                    {src}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {methodologyComparison && methodologyComparison.columns && methodologyComparison.rows && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Methodology Comparison</h4>
          <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  {methodologyComparison.columns.map((col, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {methodologyComparison.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-100 dark:border-slate-700/50 last:border-b-0">
                    {methodologyComparison.columns.map((col, ci) => (
                      <td key={ci} className="px-3 py-2 text-slate-700 dark:text-slate-300">{row[col] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Research Gaps</h4>
          <ul className="space-y-1.5">
            {gaps.map((gap, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="text-amber-500 flex-shrink-0 mt-0.5">!</span>
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/20">
          <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-2">Recommendations</h4>
          <ul className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex gap-2">
                <span className="text-emerald-500 flex-shrink-0">{i + 1}.</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function LiteratureReviewView({ data, isFullscreen, onCloseFullscreen, title }: LiteratureReviewViewProps) {
  return (
    <>
      <LiteratureReviewContent data={data} />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title}>
        <LiteratureReviewContent data={data} />
      </FullscreenWrapper>
    </>
  )
}
