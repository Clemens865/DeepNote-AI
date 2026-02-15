import { ArtifactWrapper } from './ArtifactWrapper'

interface KpiMetric {
  label: string
  value: number
  max?: number
  unit?: string
  sentiment?: 'positive' | 'warning' | 'negative' | 'neutral'
}

interface ChatArtifactKpiProps {
  data: {
    title?: string
    metrics: KpiMetric[]
  }
}

const sentimentConfig: Record<string, { bg: string; bar: string; text: string; ring: string }> = {
  positive: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'ring-emerald-200 dark:ring-emerald-500/30',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'ring-amber-200 dark:ring-amber-500/30',
  },
  negative: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    bar: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    ring: 'ring-red-200 dark:ring-red-500/30',
  },
  neutral: {
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    bar: 'bg-slate-400',
    text: 'text-slate-700 dark:text-slate-300',
    ring: 'ring-slate-200 dark:ring-slate-600',
  },
}

export function ChatArtifactKpi({ data }: ChatArtifactKpiProps) {
  return (
    <ArtifactWrapper title={data.title || 'KPI Dashboard'} jsonData={data}>
      <div className="p-3 bg-white dark:bg-slate-900 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(data.metrics.length, 3)}, 1fr)` }}>
        {data.metrics.map((metric, i) => (
          <GaugeCard key={i} metric={metric} />
        ))}
      </div>
    </ArtifactWrapper>
  )
}

function GaugeCard({ metric }: { metric: KpiMetric }) {
  const sentiment = metric.sentiment || 'neutral'
  const config = sentimentConfig[sentiment] || sentimentConfig.neutral
  const percentage = metric.max ? Math.min((metric.value / metric.max) * 100, 100) : null

  return (
    <div className={`rounded-lg p-3 ring-1 ${config.bg} ${config.ring}`}>
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {metric.label}
      </p>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${config.text}`}>
          {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
        </span>
        {metric.unit && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{metric.unit}</span>
        )}
        {metric.max != null && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">/ {metric.max.toLocaleString()}</span>
        )}
      </div>
      {percentage != null && (
        <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${config.bar}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  )
}
