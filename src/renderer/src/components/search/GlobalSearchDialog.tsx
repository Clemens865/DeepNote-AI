import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, BookOpen, FileText, Brain, HardDrive, Tag, Mail, Plus } from 'lucide-react'
import { Spinner } from '../common/Spinner'
import { useNotebookStore } from '../../stores/notebookStore'

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

interface SystemEmail {
  subject: string
  sender: string
  date: string
  chunk: string
  similarity: number
}

interface SpotlightResult {
  path: string
  name: string
  kind: string
}

type FilterTab = 'all' | 'notebooks' | 'files' | 'memories' | 'emails'

interface GlobalSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onNavigate?: (notebookId: string) => void
  initialFilter?: FilterTab
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'notebooks', label: 'Notebooks' },
  { key: 'files', label: 'Files' },
  { key: 'memories', label: 'Memories' },
  { key: 'emails', label: 'Emails' },
]

export function GlobalSearchDialog({ isOpen, onClose, onNavigate, initialFilter = 'all' }: GlobalSearchDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [systemMemories, setSystemMemories] = useState<SystemMemory[]>([])
  const [systemFiles, setSystemFiles] = useState<SystemFile[]>([])
  const [systemEmails, setSystemEmails] = useState<SystemEmail[]>([])
  const [spotlightResults, setSpotlightResults] = useState<SpotlightResult[]>([])
  const [activeFilter, setActiveFilter] = useState<FilterTab>(initialFilter)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)

  useEffect(() => {
    if (isOpen) {
      setActiveFilter(initialFilter)
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery('')
      setResults([])
      setSystemMemories([])
      setSystemFiles([])
      setSystemEmails([])
      setSpotlightResults([])
      setSearched(false)
    }
  }, [isOpen, initialFilter])

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setSystemMemories([])
      setSystemFiles([])
      setSystemEmails([])
      setSpotlightResults([])
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
      setSystemEmails(response.systemResults?.emails ?? [])
      setSpotlightResults(response.systemResults?.spotlight ?? [])
    } catch {
      setResults([])
      setSystemMemories([])
      setSystemFiles([])
      setSystemEmails([])
      setSpotlightResults([])
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

  const handleOpenFile = (filePath: string) => {
    window.api.systemOpenFile({ filePath })
  }

  const handleAddToNotebook = async (type: 'file' | 'paste', opts: { filePath?: string; content?: string; title?: string }) => {
    if (!currentNotebook) return
    try {
      if (type === 'file' && opts.filePath) {
        const ext = opts.filePath.split('.').pop() || 'txt'
        await window.api.addSource({ notebookId: currentNotebook.id, type: ext, filePath: opts.filePath })
      } else if (type === 'paste' && opts.content) {
        await window.api.addSource({ notebookId: currentNotebook.id, type: 'paste', content: opts.content, title: opts.title })
      }
    } catch {
      // silently fail — user can retry
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

  const hasNotebookResults = results.length > 0
  const hasMemories = systemMemories.length > 0
  const hasFiles = systemFiles.length > 0
  const hasEmails = systemEmails.length > 0
  const hasSpotlight = spotlightResults.length > 0
  const hasSystemResults = hasMemories || hasFiles || hasEmails || hasSpotlight
  const hasAnyResults = hasNotebookResults || hasSystemResults

  const showSection = (section: 'notebooks' | 'files' | 'memories' | 'emails') =>
    activeFilter === 'all' || activeFilter === section

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <Search size={18} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notebooks, files, emails..."
            className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none"
          />
          {loading && <Spinner size="sm" />}
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                activeFilter === tab.key
                  ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {searched && !hasAnyResults && !loading && (
            <div className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Notebook results */}
          {hasNotebookResults && showSection('notebooks') && (
            <>
              {Object.entries(grouped).map(([notebookId, group]) => (
                <div key={notebookId}>
                  <div className="px-5 py-2 bg-black/[0.03] dark:bg-white/[0.03] border-b border-black/[0.04] dark:border-white/[0.04] sticky top-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      <BookOpen size={11} />
                      {group.notebookTitle}
                    </span>
                  </div>
                  {group.items.map((result, i) => (
                    <button
                      key={`${result.sourceId}-${i}`}
                      onClick={() => onNavigate?.(notebookId)}
                      className="w-full text-left px-5 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={12} className="text-indigo-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{result.sourceTitle}</span>
                        {result.pageNumber && (
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500">p.{result.pageNumber}</span>
                        )}
                        <span className="ml-auto text-[9px] text-zinc-400 dark:text-zinc-500">
                          {(result.score * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                        {result.text}
                      </p>
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}

          {/* System section divider */}
          {hasNotebookResults && hasSystemResults && showSection('notebooks') && (
            <div className="border-t-2 border-purple-200 dark:border-purple-500/20" />
          )}

          {/* Memories */}
          {hasMemories && showSection('memories') && (
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
                  className="w-full text-left px-5 py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Tag size={12} className="text-purple-500 flex-shrink-0" />
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-medium">
                      {mem.memoryType}
                    </span>
                    <span className="ml-auto text-[9px] text-zinc-400 dark:text-zinc-500">
                      {(mem.similarity * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                    {mem.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* DeepBrain Files */}
          {hasFiles && showSection('files') && (
            <div>
              <div className="px-5 py-2 bg-purple-50 dark:bg-purple-500/10 border-b border-purple-100 dark:border-purple-500/20 sticky top-0">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wide">
                  <HardDrive size={11} />
                  System Files
                </span>
              </div>
              {systemFiles.map((file, i) => (
                <button
                  key={`file-${i}`}
                  onClick={() => handleOpenFile(file.path)}
                  className="group w-full text-left px-5 py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive size={12} className="text-purple-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{file.name}</span>
                    {file.fileType && (
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500">.{file.fileType}</span>
                    )}
                    {currentNotebook && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddToNotebook('file', { filePath: file.path }) }}
                        className="ml-1 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-500 transition-all"
                        title="Add to current notebook"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                    <span className="ml-auto text-[9px] text-zinc-400 dark:text-zinc-500">
                      {(file.similarity * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate mb-1">
                    {file.path}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                    {file.chunk}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Emails */}
          {hasEmails && showSection('emails') && (
            <div>
              <div className="px-5 py-2 bg-violet-50 dark:bg-violet-500/10 border-b border-violet-100 dark:border-violet-500/20 sticky top-0">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-wide">
                  <Mail size={11} />
                  Emails
                </span>
              </div>
              {systemEmails.map((email, i) => (
                <div
                  key={`email-${i}`}
                  className="group w-full text-left px-5 py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Mail size={12} className="text-violet-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{email.subject}</span>
                    {currentNotebook && (
                      <button
                        onClick={() => handleAddToNotebook('paste', { content: email.chunk, title: email.subject })}
                        className="ml-1 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-500 transition-all flex-shrink-0"
                        title="Add to current notebook"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                    <span className="ml-auto text-[9px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                      {(email.similarity * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                    <span className="truncate">{email.sender}</span>
                    {email.date && <span className="flex-shrink-0">{email.date}</span>}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                    {email.chunk}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Spotlight results */}
          {hasSpotlight && showSection('files') && (
            <div>
              <div className="px-5 py-2 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-100 dark:border-amber-500/20 sticky top-0">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  <Search size={11} />
                  Spotlight
                </span>
              </div>
              {spotlightResults.map((item, i) => (
                <button
                  key={`spot-${i}`}
                  onClick={() => handleOpenFile(item.path)}
                  className="group w-full text-left px-5 py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={12} className="text-amber-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.name}</span>
                    {item.kind && (
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500">.{item.kind}</span>
                    )}
                    {currentNotebook && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddToNotebook('file', { filePath: item.path }) }}
                        className="ml-1 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-500 transition-all"
                        title="Add to current notebook"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                    <span className="ml-auto text-[9px] text-amber-500 dark:text-amber-400">Spotlight</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate">
                    {item.path}
                  </p>
                </button>
              ))}
            </div>
          )}

          {!searched && !loading && (
            <div className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
              Search across all notebooks, files & emails
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]/30 flex items-center justify-between">
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            <kbd className="px-1 py-0.5 bg-black/[0.06] dark:bg-white/[0.06] rounded text-[9px] font-mono">Enter</kbd> search
            {' '}<kbd className="px-1 py-0.5 bg-black/[0.06] dark:bg-white/[0.06] rounded text-[9px] font-mono">Esc</kbd> close
          </p>
          <div className="flex items-center gap-3">
            {hasSpotlight && (
              <span className="flex items-center gap-1 text-[10px] text-amber-500 dark:text-amber-400">
                <Search size={10} />
                Spotlight
              </span>
            )}
            {hasSystemResults && (
              <span className="flex items-center gap-1 text-[10px] text-purple-500 dark:text-purple-400">
                <Brain size={10} />
                DeepBrain
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
