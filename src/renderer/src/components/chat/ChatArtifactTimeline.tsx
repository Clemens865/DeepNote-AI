import { ArtifactWrapper } from './ArtifactWrapper'

interface TimelineEvent {
  date: string
  label: string
  description?: string
}

interface ChatArtifactTimelineProps {
  data: {
    title?: string
    events: TimelineEvent[]
  }
}

export function ChatArtifactTimeline({ data }: ChatArtifactTimelineProps) {
  const sorted = [...data.events].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <ArtifactWrapper title={data.title || 'Timeline'} jsonData={data}>
      <div className="p-4 bg-white dark:bg-slate-900 overflow-x-auto">
        <div className="relative min-w-max">
          {/* Horizontal line */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700" />

          <div className="flex gap-0">
            {sorted.map((event, i) => (
              <div key={i} className="relative flex flex-col items-center" style={{ minWidth: 140 }}>
                {/* Dot */}
                <div className="relative z-10 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900 flex-shrink-0" />

                {/* Content */}
                <div className="mt-3 text-center px-2">
                  <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                    {event.date}
                  </p>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-0.5 leading-snug">
                    {event.label}
                  </p>
                  {event.description && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug max-w-[120px]">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ArtifactWrapper>
  )
}
