import {
  ResponsiveContainer,
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { FullscreenWrapper } from './FullscreenWrapper'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

interface DashboardViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

interface KpiItem {
  label: string
  value: string
  change?: string
  trend?: 'up' | 'down' | 'flat'
}

interface ChartItem {
  chartType: 'bar' | 'line' | 'pie'
  title: string
  data: Record<string, unknown>[]
  xKey: string
  yKeys: string[]
}

interface TableItem {
  title: string
  columns: string[]
  rows: string[][]
}

function KpiCard({ kpi }: { kpi: KpiItem }) {
  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus
  const trendColor = kpi.trend === 'up' ? 'text-emerald-500' : kpi.trend === 'down' ? 'text-red-500' : 'text-zinc-400'

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-4">
      <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{kpi.label}</p>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{kpi.value}</span>
        {kpi.change && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trendColor} pb-0.5`}>
            <TrendIcon size={12} />
            {kpi.change}
          </span>
        )}
      </div>
    </div>
  )
}

function DashboardChart({ chart }: { chart: ChartItem }) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-4">
      <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-3">{chart.title}</h4>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.chartType === 'pie' ? (
            <PieChart>
              <Pie data={chart.data} dataKey={chart.yKeys[0]} nameKey={chart.xKey} cx="50%" cy="50%" outerRadius={80} label>
                {chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          ) : chart.chartType === 'line' ? (
            <LineChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey={chart.xKey} tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#475569" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#475569" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11, color: '#e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {chart.yKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey={chart.xKey} tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#475569" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#475569" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11, color: '#e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {chart.yKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DashboardContent({ data }: { data: Record<string, unknown> }) {
  const dashTitle = data.title as string | undefined
  const kpis = (data.kpis as KpiItem[]) || []
  const charts = (data.charts as ChartItem[]) || []
  const tables = (data.tables as TableItem[]) || []

  return (
    <div className="space-y-4">
      {dashTitle && <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">{dashTitle}</h3>}

      {kpis.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, 1fr)` }}>
          {kpis.map((kpi, i) => <KpiCard key={i} kpi={kpi} />)}
        </div>
      )}

      {charts.length > 0 && (
        <div className={`grid gap-3 ${charts.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {charts.map((chart, i) => <DashboardChart key={i} chart={chart} />)}
        </div>
      )}

      {tables.map((table, ti) => (
        <div key={ti} className="bg-white dark:bg-zinc-800 rounded-xl border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
          <div className="px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.06] dark:border-white/[0.06]">
            <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{table.title}</h4>
          </div>
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-black/[0.02] dark:bg-white/[0.02]">
                <tr>
                  {table.columns.map((col, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-zinc-600 dark:text-zinc-300 border-b border-black/[0.06] dark:border-white/[0.06]">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardView({ data, isFullscreen, onCloseFullscreen, title }: DashboardViewProps) {
  return (
    <>
      <DashboardContent data={data} />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title} wide>
        <DashboardContent data={data} />
      </FullscreenWrapper>
    </>
  )
}
