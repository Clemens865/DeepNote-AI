import { FullscreenWrapper } from './FullscreenWrapper'

interface DiffViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

interface DiffSection {
  heading: string
  sourceA: string
  sourceB: string
  status: 'added' | 'removed' | 'changed' | 'unchanged'
  commentary?: string
}

const statusConfig: Record<string, { label: string; bg: string; badge: string }> = {
  added: { label: 'Added', bg: 'bg-emerald-50/50 dark:bg-emerald-500/5', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  removed: { label: 'Removed', bg: 'bg-red-50/50 dark:bg-red-500/5', badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
  changed: { label: 'Changed', bg: 'bg-amber-50/50 dark:bg-amber-500/5', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  unchanged: { label: 'Unchanged', bg: 'bg-black/[0.02] dark:bg-white/[0.02]', badge: 'bg-black/[0.03] text-zinc-600 dark:bg-white/[0.03] dark:text-zinc-400' },
}

function DiffContent({ data }: { data: Record<string, unknown> }) {
  const diffTitle = data.title as string | undefined
  const summary = data.summary as string | undefined
  const sourceAName = (data.sourceAName as string) || 'Source A'
  const sourceBName = (data.sourceBName as string) || 'Source B'
  const sections = (data.sections as DiffSection[]) || []

  const counts = {
    added: sections.filter(s => s.status === 'added').length,
    removed: sections.filter(s => s.status === 'removed').length,
    changed: sections.filter(s => s.status === 'changed').length,
    unchanged: sections.filter(s => s.status === 'unchanged').length,
  }

  return (
    <div className="space-y-4">
      {diffTitle && <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">{diffTitle}</h3>}

      {summary && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{summary}</p>
      )}

      {/* Stats */}
      <div className="flex gap-3">
        {Object.entries(counts).filter(([, v]) => v > 0).map(([status, count]) => (
          <span key={status} className={`text-[10px] font-bold uppercase rounded px-2 py-1 ${statusConfig[status].badge}`}>
            {count} {statusConfig[status].label}
          </span>
        ))}
      </div>

      {/* Side-by-side sections */}
      <div className="space-y-3">
        {sections.map((section, i) => {
          const config = statusConfig[section.status] || statusConfig.unchanged
          return (
            <div key={i} className={`rounded-xl border border-black/[0.06] dark:border-white/[0.06] overflow-hidden ${config.bg}`}>
              <div className="flex items-center justify-between px-4 py-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                <h5 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{section.heading}</h5>
                <span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 ${config.badge}`}>
                  {config.label}
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-black/[0.06] dark:divide-white/[0.06]">
                <div className="p-3">
                  <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-500 uppercase mb-1">{sourceAName}</p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {section.sourceA || '—'}
                  </p>
                </div>
                <div className="p-3">
                  <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-500 uppercase mb-1">{sourceBName}</p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {section.sourceB || '—'}
                  </p>
                </div>
              </div>
              {section.commentary && (
                <div className="px-4 py-2 border-t border-black/[0.06] dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02]">
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 italic">{section.commentary}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DiffView({ data, isFullscreen, onCloseFullscreen, title }: DiffViewProps) {
  return (
    <>
      <DiffContent data={data} />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title} wide>
        <DiffContent data={data} />
      </FullscreenWrapper>
    </>
  )
}
