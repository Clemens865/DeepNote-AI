import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, FileText, Hash } from 'lucide-react'
import type { Note } from '../../../../shared/types'

interface NoteSearchProps {
  notebookId: string
  onSelectNote: (noteId: string) => void
}

/** Strip HTML tags for snippet display */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

/** Extract a snippet around the first match of query in text */
function extractSnippet(text: string, query: string, contextChars = 60): string {
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  const idx = lower.indexOf(qLower)

  if (idx === -1) return text.slice(0, contextChars * 2)

  const start = Math.max(0, idx - contextChars)
  const end = Math.min(text.length, idx + query.length + contextChars)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''

  return prefix + text.slice(start, end) + suffix
}

/** Parse tags from a note's tags field */
function parseTags(tags: string | string[]): string[] {
  if (Array.isArray(tags)) return tags
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface HighlightedTextProps {
  text: string
  query: string
}

function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query.trim()) return <>{text}</>

  const parts: { text: string; highlight: boolean }[] = []
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  let lastIndex = 0

  let idx = lower.indexOf(qLower, lastIndex)
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ text: text.slice(lastIndex, idx), highlight: false })
    }
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true })
    lastIndex = idx + query.length
    idx = lower.indexOf(qLower, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false })
  }

  return (
    <>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark
            key={i}
            className="bg-yellow-200/80 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

export function NoteSearch({ notebookId, onSelectNote }: NoteSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([])
        setHasSearched(false)
        return
      }

      setLoading(true)
      setHasSearched(true)

      try {
        const notes = await window.api.notesSearch({
          notebookId,
          query: searchQuery.trim(),
        })
        setResults(notes)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [notebookId]
  )

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      doSearch(query)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, doSearch])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleClear = () => {
    setQuery('')
    setResults([])
    setHasSearched(false)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="p-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-8 pr-8 py-2 text-xs rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors"
            >
              <X size={12} className="text-zinc-400 dark:text-zinc-500" />
            </button>
          )}
        </div>
        {hasSearched && !loading && (
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 px-1">
            {results.length} {results.length === 1 ? 'result' : 'results'} found
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Search size={24} className="text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
              No notes matching &ldquo;{query}&rdquo;
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="p-2 space-y-1">
            {results.map((note) => {
              const plainContent = stripHtml(note.content)
              const snippet = extractSnippet(plainContent, query)
              const tags = parseTags(note.tags)

              return (
                <button
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors border border-transparent hover:border-black/[0.04] dark:hover:border-white/[0.04] group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText
                      size={12}
                      className="text-zinc-400 dark:text-zinc-500 flex-shrink-0"
                    />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                      <HighlightedText text={note.title} query={query} />
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-relaxed ml-[18px]">
                    <HighlightedText text={snippet} query={query} />
                  </p>
                  {tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 ml-[18px] flex-wrap">
                      {tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-black/[0.04] dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400"
                        >
                          <Hash size={8} />
                          {tag.replace(/^#/, '')}
                        </span>
                      ))}
                      {tags.length > 4 && (
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
                          +{tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {!loading && !hasSearched && (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Search size={24} className="text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
              Type to search across all notes in this notebook
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
