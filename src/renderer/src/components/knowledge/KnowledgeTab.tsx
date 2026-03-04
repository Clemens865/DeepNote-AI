import { useState, useEffect } from 'react'
import { Search, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

interface KnowledgeItem {
  id: string
  content: string
  type: string
  importance: number
  sourceTitle: string | null
  tags: string[]
  createdAt: number
}

const TYPE_COLORS: Record<string, string> = {
  document: '#6366f1',
  note: '#8b5cf6',
  manual: '#a855f7',
  clipboard: '#f59e0b',
  chat: '#3b82f6',
}

const TYPES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'document', label: 'Documents' },
  { id: 'note', label: 'Notes' },
  { id: 'manual', label: 'Manual' },
  { id: 'clipboard', label: 'Clipboard' },
  { id: 'chat', label: 'Chat' },
]

const PAGE_SIZE = 30

export function KnowledgeTab() {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; content: string; type: string; similarity: number; sourceTitle: string | null }[] | null>(null)

  const loadMemories = async () => {
    const type = typeFilter === 'all' ? undefined : typeFilter
    const result = await window.api.knowledgeList({ type, offset: page * PAGE_SIZE, limit: PAGE_SIZE })
    setItems(result.items)
    setTotal(result.total)
  }

  useEffect(() => {
    setSearchResults(null)
    loadMemories()
  }, [typeFilter, page])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      loadMemories()
      return
    }
    const results = await window.api.knowledgeSearch({ query: searchQuery, limit: 20 })
    setSearchResults(results)
  }

  const handleDelete = async (id: string) => {
    await window.api.knowledgeDelete({ id })
    loadMemories()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const displayItems = searchResults || items

  return (
    <div className="flex flex-col h-full">
      {/* Search + filter */}
      <div className="shrink-0 p-3 space-y-2 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Semantic search..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>
          <button onClick={handleSearch} className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-700">
            Search
          </button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTypeFilter(t.id); setPage(0); setSearchResults(null) }}
              className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
                typeFilter === t.id
                  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                  : 'text-zinc-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-auto">
        {displayItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">
            {searchResults ? 'No results found' : 'No memories yet. Add folders in Connectors tab to start indexing.'}
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {displayItems.map((item) => (
              <div key={item.id} className="group p-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="px-1.5 py-0.5 text-[10px] rounded-full font-medium text-white capitalize"
                    style={{ backgroundColor: TYPE_COLORS[item.type] || '#71717a' }}
                  >
                    {item.type}
                  </span>
                  {'similarity' in item && (
                    <span className="text-[10px] text-violet-500 font-medium">
                      {Math.round((item as { similarity: number }).similarity * 100)}%
                    </span>
                  )}
                  {item.sourceTitle && (
                    <span className="text-[10px] text-zinc-400 truncate">{item.sourceTitle}</span>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-3">{item.content}</p>
                {'createdAt' in item && item.createdAt && (
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!searchResults && totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-black/[0.06] dark:border-white/[0.06]">
          <span className="text-xs text-zinc-500">{total} total</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-black/[0.04] disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-zinc-600 dark:text-zinc-400 px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-black/[0.04] disabled:opacity-30"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
