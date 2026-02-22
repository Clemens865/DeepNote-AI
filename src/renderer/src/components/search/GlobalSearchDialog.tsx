import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, BookOpen, FileText, Brain, HardDrive, Tag } from 'lucide-react'
import { Spinner } from '../common/Spinner'

interface SearchResult {
  notebookId: string
  notebookTitle: string
  sourceId: string
  sourceTitle: string
  text: string
  score: number
  pageNumber?: number
}

interface SystemMemory {
  content: string
  memoryType: string
  similarity: number
}

interface SystemFile {
  path: string
  name: string
  chunk: string
  similarity: number
  fileType: string
}

interface GlobalSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onNavigate?: (notebookId: string) => void
}

export function GlobalSearchDialog({ isOpen, onClose, onNavigate }: GlobalSearchDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [systemMemories, setSystemMemories] = useState<SystemMemory[]>([])
  const [systemFiles, setSystemFiles] = useState<SystemFile[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery('')
      setResults([])
      setSystemMemories([])
      setSystemFiles([])
      setSearched(false)
    }
  }, [isOpen])

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setSystemMemories([])
      setSystemFiles([])
      setSearched(false)
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const response = await window.api.globalSearch({ query: searchQuery.trim(), limit: 15 })
      setResults(response.results ?? [])
      setSystemMemories(response.systemResults?.memories ?? [])
      setSystemFiles(response.systemResults?.files ?? [])
    } catch {
      setResults([])
      setSystemMemories([])
      setSystemFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(value), 400)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      handleSearch(query)
    }
  }

  // Group results by notebook
  const grouped = results.reduce<Record<string, { notebookTitle: string; items: SearchResult[] }>>((acc, r) => {
    if (!acc[r.notebookId]) {
      acc[r.notebookId] = { notebookTitle: r.notebookTitle, items: [] }
    }
    acc[r.notebookId].items.push(r)
    return acc
  }, {})

  const hasSystemResults = systemMemories.length > 0 || systemFiles.length > 0
  const hasNotebookResults = results.length > 0
  const hasAnyResults = hasNotebookResults || hasSystemResults

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <Search size={18} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notebooks & system..."
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />
          {loading && <Spinner size="sm" />}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {searched && !hasAnyResults && !loading && (
            <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Notebook results */}
          {hasNotebookResults && (
            <>
              {Object.entries(grouped).map(([notebookId, group]) => (
                <div key={notebookId}>
                  <div className="px-5 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 sticky top-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      <BookOpen size={11} />
                      {group.notebookTitle}
                    </span>
                  </div>
                  {group.items.map((result, i) => (
                    <button
                      key={`${result.sourceId}-${i}`}
                      onClick={() => onNavigate?.(notebookId)}
                      className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={12} className="text-indigo-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{result.sourceTitle}</span>
                        {result.pageNumber && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">p.{result.pageNumber}</span>
                        )}
                        <span className="ml-auto text-[9px] text-slate-400 dark:text-slate-500">
                          {(result.score * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {result.text}
                      </p>
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}

          {/* DeepBrain system results */}
          {hasSystemResults && (
            <>
              {/* Divider between notebook and system results */}
              {hasNotebookResults && (
                <div className="border-t-2 border-purple-200 dark:border-purple-500/20" />
              )}

              {/* Memories */}
              {systemMemories.length > 0 && (
                <div>
                  <div className="px-5 py-2 bg-purple-50 dark:bg-purple-500/10 border-b border-purple-100 dark:border-purple-500/20 sticky top-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wide">
                      <Brain size={11} />
                      DeepBrain Memories
                    </span>
                  </div>
                  {systemMemories.map((mem, i) => (
                    <div
                      key={`mem-${i}`}
                      className="w-full text-left px-5 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Tag size={12} className="text-purple-500 flex-shrink-0" />
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-medium">
                          {mem.memoryType}
                        </span>
                        <span className="ml-auto text-[9px] text-slate-400 dark:text-slate-500">
                          {(mem.similarity * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {mem.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Files */}
              {systemFiles.length > 0 && (
                <div>
                  <div className="px-5 py-2 bg-purple-50 dark:bg-purple-500/10 border-b border-purple-100 dark:border-purple-500/20 sticky top-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wide">
                      <HardDrive size={11} />
                      System Files
                    </span>
                  </div>
                  {systemFiles.map((file, i) => (
                    <div
                      key={`file-${i}`}
                      className="w-full text-left px-5 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <HardDrive size={12} className="text-purple-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{file.name}</span>
                        {file.fileType && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">.{file.fileType}</span>
                        )}
                        <span className="ml-auto text-[9px] text-slate-400 dark:text-slate-500">
                          {(file.similarity * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate mb-1">
                        {file.path}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {file.chunk}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!searched && !loading && (
            <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              Search across all notebooks{hasSystemResults ? ' & system' : ''}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Enter</kbd> to search, <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Esc</kbd> to close
          </p>
          {hasSystemResults && (
            <span className="flex items-center gap-1 text-[10px] text-purple-500 dark:text-purple-400">
              <Brain size={10} />
              DeepBrain connected
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
