import { useState } from 'react'
import { Database, Sparkles, Search } from 'lucide-react'

interface KnowledgeStatus {
  enabled: boolean
  total: number
  byType: Record<string, number>
  folderCount: number
}

const TYPE_COLORS: Record<string, string> = {
  document: '#6366f1',
  note: '#8b5cf6',
  manual: '#a855f7',
  clipboard: '#f59e0b',
  chat: '#3b82f6',
}

interface Props {
  status: KnowledgeStatus | null
  onRefresh: () => void
}

export function OverviewTab({ status }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; content: string; type: string; similarity: number; sourceTitle: string | null }[]>([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await window.api.knowledgeSearch({ query: searchQuery, limit: 5 })
      setSearchResults(results)
    } catch {
      setSearchResults([])
    }
    setSearching(false)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs mb-2">
            <Database className="w-3.5 h-3.5" />
            Total Memories
          </div>
          <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {status?.total.toLocaleString() ?? '0'}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Scan Folders
          </div>
          <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {status?.folderCount ?? 0}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs mb-2">
            <Search className="w-3.5 h-3.5" />
            Status
          </div>
          <div className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            {status?.enabled ? 'Active' : 'Disabled'}
          </div>
        </div>
      </div>

      {/* Type breakdown */}
      {status?.byType && Object.keys(status.byType).length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-black/[0.06] dark:border-white/[0.06]">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Memory Types</h3>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(status.byType).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[type] || '#71717a' }}
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-400 capitalize">{type}</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick search */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-black/[0.06] dark:border-white/[0.06]">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Quick Search</h3>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your knowledge base..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((r) => (
              <div key={r.id} className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="px-1.5 py-0.5 text-[10px] rounded-full font-medium text-white capitalize"
                    style={{ backgroundColor: TYPE_COLORS[r.type] || '#71717a' }}
                  >
                    {r.type}
                  </span>
                  <span className="text-[10px] text-zinc-500">{Math.round(r.similarity * 100)}%</span>
                  {r.sourceTitle && (
                    <span className="text-[10px] text-zinc-400 truncate">{r.sourceTitle}</span>
                  )}
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">{r.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
