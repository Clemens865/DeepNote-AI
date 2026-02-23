import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { ArtifactWrapper } from './ArtifactWrapper'

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

interface ChatArtifactChartProps {
  data: {
    chartType: 'bar' | 'line' | 'pie'
    title?: string
    data: Record<string, unknown>[]
    xKey: string
    yKeys: string[]
  }
}

export function ChatArtifactChart({ data }: ChatArtifactChartProps) {
  if (!data.data || data.data.length === 0) {
    return (
      <div className="my-2 p-4 rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-xs text-zinc-400">
        No chart data available
      </div>
    )
  }

  return (
    <ArtifactWrapper title={data.title || 'Chart'} jsonData={data}>
      <div className="p-3 bg-white dark:bg-zinc-900" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          {data.chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={data.data}
                dataKey={data.yKeys[0]}
                nameKey={data.xKey}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(props) =>
                  `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {data.data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          ) : data.chartType === 'line' ? (
            <LineChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                dataKey={data.xKey}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                stroke="#475569"
              />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#475569" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#e2e8f0',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {data.yKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                dataKey={data.xKey}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                stroke="#475569"
              />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#475569" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#e2e8f0',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {data.yKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </ArtifactWrapper>
  )
}
