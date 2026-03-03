import { useState, useEffect, useCallback } from 'react'
import {
  Search, Trash2, Loader2, ChevronLeft, ChevronRight, Sparkles, HardDrive, AlertCircle,
} from 'lucide-react'

interface MemoryItem {
  id: string
  content: string
  memoryType: string
  importance: number
  createdAt?: string
  similarity?: number
}

const MEMORY_TYPES = ['all', 'semantic', 'episodic', 'working', 'procedural', 'meta', 'causal', 'goal', 'emotional'] as const

const MEMORY_TYPE_COLORS: Record<string, string> = {
  semantic: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  episodic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  working: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  procedural: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  meta: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  causal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  goal: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  emotional: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const PAGE_SIZE = 30

export function MemoriesTab() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [activeType, setActiveType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionRunning, setActionRunning] = useState<string | null>(null)

  const fetchMemories = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.deepbrainMemories({
        type: activeType === 'all' ? undefined : activeType,
        offset,
        limit: PAGE_SIZE,
      })
      setMemories(result.items || [])
      setTotal(result.total || 0)
    } catch {
      setMemories([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [activeType, offset])

  useEffect(() => {
    if (!isSearching) fetchMemories()
  }, [fetchMemories, isSearching])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    setLoading(true)
    try {
      const results = await window.api.deepbrainRecall({ query: searchQuery, limit: 50 })
      setMemories(
        (results || []).map((r: { id: string; content: string; similarity: number; memoryType: string }) => ({
          id: r.id,
          content: r.content,
          memoryType: r.memoryType,
          importance: 0,
          similarity: r.similarity,
        }))
      )
      setTotal(results?.length || 0)
    } catch {
      setMemories([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await window.api.deepbrainMemoryDelete({ id })
      setMemories((prev) => prev.filter((m) => m.id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleEvolve = async () => {
    setActionRunning('evolve')
    try {
      await window.api.deepbrainBrainEvolve()
    } catch (err) {
      console.error('Evolve failed:', err)
    } finally {
      setActionRunning(null)
    }
  }

  const handleFlush = async () => {
    setActionRunning('flush')
    try {
      await window.api.deepbrainBrainFlush()
    } catch (err) {
      console.error('Flush failed:', err)
    } finally {
      setActionRunning(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="p-6 space-y-4">
      {/* Top bar: search + actions */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (!e.target.value.trim()) setIsSearching(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search memories by content..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 placeholder-zinc-400"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-3 py-2 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        >
          Search
        </button>
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />
        <button
          onClick={handleEvolve}
          disabled={actionRunning !== null}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          title="Trigger SONA learning evolution"
        >
          {actionRunning === 'evolve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Evolve
        </button>
        <button
          onClick={handleFlush}
          disabled={actionRunning !== null}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          title="Flush memories to disk"
        >
          {actionRunning === 'flush' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
          Flush
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {MEMORY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveType(type)
              setOffset(0)
              setIsSearching(false)
              setSearchQuery('')
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
              activeType === type
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {isSearching ? `${total} search results` : `${total} memories`}
          {activeType !== 'all' && !isSearching && ` (${activeType})`}
        </span>
        {!isSearching && total > PAGE_SIZE && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Memory list */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-zinc-400">
          <AlertCircle className="w-8 h-8" />
          <p className="text-sm">No memories found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-4 group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${MEMORY_TYPE_COLORS[memory.memoryType] || 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                      {memory.memoryType}
                    </span>
                    {memory.importance > 0 && (
                      <span className="text-[10px] text-zinc-400">
                        importance: {memory.importance.toFixed(2)}
                      </span>
                    )}
                    {memory.similarity !== undefined && (
                      <span className="text-[10px] text-violet-500 font-medium">
                        {(memory.similarity * 100).toFixed(1)}% match
                      </span>
                    )}
                    {memory.createdAt && (
                      <span className="text-[10px] text-zinc-400 ml-auto">
                        {new Date(memory.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap line-clamp-4">
                    {memory.content}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(memory.id)}
                  disabled={deletingId === memory.id}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                  title="Delete memory"
                >
                  {deletingId === memory.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
