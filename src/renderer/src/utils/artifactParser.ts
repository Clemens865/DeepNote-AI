export interface TextSegment {
  type: 'text'
  content: string
}

export interface TableArtifact {
  type: 'artifact-table'
  data: { columns: string[]; rows: string[][] }
}

export interface ChartArtifact {
  type: 'artifact-chart'
  data: {
    chartType: 'bar' | 'line' | 'pie'
    title?: string
    data: Record<string, unknown>[]
    xKey: string
    yKeys: string[]
  }
}

export interface MermaidArtifact {
  type: 'artifact-mermaid'
  data: {
    title?: string
    code: string
  }
}

export interface KanbanArtifact {
  type: 'artifact-kanban'
  data: {
    title?: string
    items: {
      task: string
      assignee?: string
      priority?: 'high' | 'medium' | 'low'
      status?: 'todo' | 'in-progress' | 'done'
    }[]
  }
}

export interface KpiArtifact {
  type: 'artifact-kpi'
  data: {
    title?: string
    metrics: {
      label: string
      value: number
      max?: number
      unit?: string
      sentiment?: 'positive' | 'warning' | 'negative' | 'neutral'
    }[]
  }
}

export interface TimelineArtifact {
  type: 'artifact-timeline'
  data: {
    title?: string
    events: {
      date: string
      label: string
      description?: string
    }[]
  }
}

export type MessageSegment =
  | TextSegment
  | TableArtifact
  | ChartArtifact
  | MermaidArtifact
  | KanbanArtifact
  | KpiArtifact
  | TimelineArtifact

const ARTIFACT_REGEX = /```artifact-(table|chart|mermaid|kanban|kpi|timeline)\n([\s\S]*?)```/g

export function parseArtifacts(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  let lastIndex = 0

  for (const match of content.matchAll(ARTIFACT_REGEX)) {
    const matchStart = match.index!
    const matchEnd = matchStart + match[0].length

    // Text before this artifact
    if (matchStart > lastIndex) {
      const text = content.slice(lastIndex, matchStart).trim()
      if (text) segments.push({ type: 'text', content: text })
    }

    const artifactType = match[1] as 'table' | 'chart' | 'mermaid' | 'kanban' | 'kpi' | 'timeline'
    const jsonStr = match[2].trim()

    try {
      const parsed = JSON.parse(jsonStr)

      if (artifactType === 'table' && parsed.columns && parsed.rows) {
        segments.push({
          type: 'artifact-table',
          data: {
            columns: parsed.columns,
            rows: parsed.rows,
          },
        })
      } else if (artifactType === 'chart' && parsed.chartType && parsed.data && parsed.xKey && parsed.yKeys) {
        segments.push({
          type: 'artifact-chart',
          data: {
            chartType: parsed.chartType,
            title: parsed.title,
            data: parsed.data,
            xKey: parsed.xKey,
            yKeys: parsed.yKeys,
          },
        })
      } else if (artifactType === 'mermaid' && parsed.code) {
        // Normalize literal \n sequences to actual newlines
        const normalizedCode = parsed.code.replace(/\\n/g, '\n')
        segments.push({
          type: 'artifact-mermaid',
          data: {
            title: parsed.title,
            code: normalizedCode,
          },
        })
      } else if (artifactType === 'kanban' && parsed.items) {
        segments.push({
          type: 'artifact-kanban',
          data: {
            title: parsed.title,
            items: parsed.items,
          },
        })
      } else if (artifactType === 'kpi' && parsed.metrics) {
        segments.push({
          type: 'artifact-kpi',
          data: {
            title: parsed.title,
            metrics: parsed.metrics,
          },
        })
      } else if (artifactType === 'timeline' && parsed.events) {
        segments.push({
          type: 'artifact-timeline',
          data: {
            title: parsed.title,
            events: parsed.events,
          },
        })
      } else {
        // Malformed artifact — render as text
        segments.push({ type: 'text', content: match[0] })
      }
    } catch {
      // JSON parse failed — render as text
      segments.push({ type: 'text', content: match[0] })
    }

    lastIndex = matchEnd
  }

  // Remaining text after last artifact
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) segments.push({ type: 'text', content: text })
  }

  // If no artifacts found, return single text segment
  if (segments.length === 0) {
    segments.push({ type: 'text', content })
  }

  return segments
}
