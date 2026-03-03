import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, Download, Loader2, FileText, Hash, TrendingUp, BarChart3,
} from 'lucide-react'

interface TopicItem {
  slug: string
  name: string
  sizeBytes: number
  modifiedTs: number
  memoryCount: number
}

interface TopicsStats {
  topicsWritten: number
  memoriesExported: number
  consolidationCycles: number
  avgSalience: number
}

interface TopicsResponse {
  topics: TopicItem[]
  stats: TopicsStats | null
  lastExported: number | null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  if (!ts) return 'Never'
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-4">
      <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  )
}

function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n')
  const nodes: React.ReactNode[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="list-disc list-inside space-y-1 text-zinc-600 dark:text-zinc-400 text-sm ml-3 mb-3">
          {listItems.map((item, i) => (
            <li key={i}>{inlineFormat(item)}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  const inlineFormat = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    let remaining = text
    let key = 0

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
      const italicMatch = remaining.match(/\*(.+?)\*/)

      const match = boldMatch && italicMatch
        ? (boldMatch.index! <= italicMatch.index! ? boldMatch : italicMatch)
        : boldMatch || italicMatch

      if (!match || match.index === undefined) {
        parts.push(<span key={key++}>{remaining}</span>)
        break
      }

      if (match.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, match.index)}</span>)
      }

      if (match[0].startsWith('**')) {
        parts.push(<strong key={key++} className="font-semibold text-zinc-900 dark:text-zinc-100">{match[1]}</strong>)
      } else {
        parts.push(<em key={key++} className="italic">{match[1]}</em>)
      }

      remaining = remaining.slice(match.index + match[0].length)
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('# ')) {
      flushList()
      nodes.push(
        <h1 key={i} className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 mt-2">{line.slice(2)}</h1>
      )
    } else if (line.startsWith('## ')) {
      flushList()
      nodes.push(
        <h2 key={i} className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2 mt-6 pb-1 border-b border-black/[0.06] dark:border-white/[0.06]">{line.slice(3)}</h2>
      )
    } else if (line.startsWith('### ')) {
      flushList()
      nodes.push(
        <h3 key={i} className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-1 mt-4">{line.slice(4)}</h3>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2))
    } else if (line.startsWith('---')) {
      flushList()
      nodes.push(<hr key={i} className="border-black/[0.06] dark:border-white/[0.06] my-4" />)
    } else if (line.trim() === '') {
      flushList()
    } else {
      flushList()
      nodes.push(
        <p key={i} className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 leading-relaxed">{inlineFormat(line)}</p>
      )
    }
  }

  flushList()
  return nodes
}

export function KnowledgeTab() {
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<TopicItem[]>([])
  const [stats, setStats] = useState<TopicsStats | null>(null)
  const [lastExported, setLastExported] = useState<number | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [selectedContent, setSelectedContent] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)

  const loadTopics = useCallback(async () => {
    setLoading(true)
    try {
      const data: TopicsResponse = await window.api.deepbrainKnowledgeTopics()
      setTopics(data.topics || [])
      setStats(data.stats)
      setLastExported(data.lastExported)
    } catch (e) {
      console.error('Failed to load topics:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTopics()
  }, [loadTopics])

  const handleExport = async () => {
    setExporting(true)
    try {
      await window.api.deepbrainExportKnowledge()
      await loadTopics()
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  const handleSelectTopic = async (slug: string) => {
    setSelectedSlug(slug)
    setContentLoading(true)
    try {
      const data = await window.api.deepbrainKnowledgeTopic({ slug })
      setSelectedContent(data?.content || null)
    } catch (e) {
      console.error('Failed to load topic:', e)
      setSelectedContent(null)
    } finally {
      setContentLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-500" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Knowledge Export</h2>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            {lastExported
              ? `Last exported: ${formatDate(lastExported)}`
              : 'Not yet exported — click Export Now to generate topic files'}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export Now
            </>
          )}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <StatCard
          label="Topics"
          value={stats?.topicsWritten ?? topics.length}
          icon={<FileText className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Memories"
          value={stats?.memoriesExported ?? 0}
          icon={<Hash className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Cycles"
          value={stats?.consolidationCycles ?? 0}
          icon={<BarChart3 className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Avg Salience"
          value={stats?.avgSalience != null ? stats.avgSalience.toFixed(2) : '—'}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Split pane: topic list + content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Topic list */}
        <div className="w-64 shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] overflow-y-auto bg-white/40 dark:bg-black/20">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : topics.length === 0 ? (
            <div className="p-6 text-center text-zinc-400 dark:text-zinc-500 text-sm">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
              <p>No topics yet</p>
              <p className="text-xs mt-1">Click "Export Now" to generate</p>
            </div>
          ) : (
            topics.map((topic) => (
              <button
                key={topic.slug}
                onClick={() => handleSelectTopic(topic.slug)}
                className={`w-full text-left px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.04] transition-colors ${
                  selectedSlug === topic.slug
                    ? 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                }`}
              >
                <div className="text-sm font-medium truncate">{topic.name}</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {topic.memoryCount} {topic.memoryCount === 1 ? 'memory' : 'memories'}
                  </span>
                  <span className="text-xs text-zinc-300 dark:text-zinc-600">
                    {formatBytes(topic.sizeBytes)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Content pane */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          {contentLoading ? (
            <div className="flex items-center justify-center h-full text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : selectedContent ? (
            <div className="max-w-3xl">{renderMarkdown(selectedContent)}</div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500">
              <FileText className="w-10 h-10 mb-3 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm">
                {topics.length > 0
                  ? 'Select a topic to view its content'
                  : 'Export knowledge to see topics here'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
