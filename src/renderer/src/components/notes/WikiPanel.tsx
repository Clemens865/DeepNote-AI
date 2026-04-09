import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNotebookStore } from '../../stores/notebookStore'
import {
  BookOpen, RefreshCw, Sparkles, Tag, Link2, FileText,
  AlertTriangle, ChevronDown, ChevronRight, Shield, Layers,
  GitCompare, Eye, Hash,
} from 'lucide-react'

type PageType = 'entity' | 'concept' | 'topic' | 'comparison' | 'overview' | 'source-summary'
type Coverage = 'high' | 'medium' | 'low'

interface WikiPage {
  id: string
  title: string
  content: string
  pageType: PageType
  coverage: Coverage
  confidence: number
  sourceIds: string[]
  relatedPages: string[]
  tags: string[]
}

interface LintResult {
  orphanPages: WikiPage[]
  lowCoveragePages: WikiPage[]
  disconnectedPages: WikiPage[]
}

const PAGE_TYPES: { value: PageType | 'all'; label: string; icon: typeof FileText }[] = [
  { value: 'all', label: 'All', icon: Layers },
  { value: 'entity', label: 'Entity', icon: Hash },
  { value: 'concept', label: 'Concept', icon: Sparkles },
  { value: 'topic', label: 'Topic', icon: BookOpen },
  { value: 'comparison', label: 'Comparison', icon: GitCompare },
  { value: 'overview', label: 'Overview', icon: Eye },
]

const TYPE_COLORS: Record<PageType, string> = {
  entity: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  concept: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  topic: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  comparison: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  overview: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
  'source-summary': 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-400',
}

const COVERAGE_COLORS: Record<Coverage, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  low: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
}

export function WikiPanel() {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const sources = useNotebookStore((s) => s.sources)
  const [pages, setPages] = useState<WikiPage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<PageType | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [lintResults, setLintResults] = useState<LintResult | null>(null)
  const [lintOpen, setLintOpen] = useState(false)
  const [linting, setLinting] = useState(false)

  const loadPages = useCallback(async () => {
    if (!currentNotebook) return
    setLoading(true)
    try {
      const result = await window.api.wikiPagesList(currentNotebook.id)
      setPages(result as WikiPage[])
    } catch {
      setPages([])
    } finally {
      setLoading(false)
    }
  }, [currentNotebook])

  useEffect(() => {
    loadPages()
    setSelectedId(null)
    setLintResults(null)
  }, [loadPages])

  const filteredPages = useMemo(
    () => (filterType === 'all' ? pages : pages.filter((p) => p.pageType === filterType)),
    [pages, filterType],
  )

  const selectedPage = pages.find((p) => p.id === selectedId) ?? null

  const handleIngestAll = async () => {
    if (!currentNotebook || ingesting) return
    setIngesting(true)
    try {
      for (const source of sources) {
        await window.api.wikiIngest({ notebookId: currentNotebook.id, sourceId: source.id })
      }
      await loadPages()
    } finally {
      setIngesting(false)
    }
  }

  const handleLint = async () => {
    if (!currentNotebook || linting) return
    setLinting(true)
    try {
      const result = await window.api.wikiLint(currentNotebook.id)
      setLintResults(result as LintResult)
      setLintOpen(true)
    } finally {
      setLinting(false)
    }
  }

  const navigateToPage = (pageId: string) => {
    setSelectedId(pageId)
  }

  // Empty state
  if (!loading && pages.length === 0) {
    return (
      <div className="h-full flex flex-col bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Knowledge Wiki</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <BookOpen className="w-10 h-10 text-zinc-400 dark:text-zinc-500 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            No wiki pages yet
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mb-6">
            The Knowledge Wiki automatically generates structured pages about entities, concepts, and
            topics found in your sources. Click below to start.
          </p>
          <button
            onClick={handleIngestAll}
            disabled={ingesting || sources.length === 0}
            className="px-4 py-2 text-xs rounded-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 font-medium shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {ingesting ? 'Generating...' : 'Generate Wiki from Sources'}
          </button>
          {sources.length === 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">
              Add sources to your notebook first.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Knowledge Wiki</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 font-medium">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLint}
            disabled={linting}
            className="px-3 py-1.5 text-xs rounded-full border border-black/[0.08] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-all flex items-center gap-1 font-medium"
          >
            <Shield className="w-3.5 h-3.5" />
            {linting ? 'Checking...' : 'Lint'}
          </button>
          <button
            onClick={handleIngestAll}
            disabled={ingesting || sources.length === 0}
            className="px-3 py-1.5 text-xs rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-all flex items-center gap-1 font-medium shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${ingesting ? 'animate-spin' : ''}`} />
            {ingesting ? 'Ingesting...' : 'Ingest All'}
          </button>
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1 px-6 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] overflow-x-auto">
        {PAGE_TYPES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setFilterType(value)}
            className={`px-3 py-1 text-xs rounded-full flex items-center gap-1 font-medium transition-all whitespace-nowrap ${
              filterType === value
                ? 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Lint results */}
      {lintResults && (
        <div className="border-b border-black/[0.06] dark:border-white/[0.06]">
          <button
            onClick={() => setLintOpen(!lintOpen)}
            className="w-full flex items-center gap-2 px-6 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-colors"
          >
            {lintOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <AlertTriangle className="w-3 h-3" />
            Lint Results
          </button>
          {lintOpen && (
            <div className="px-6 pb-3 space-y-2">
              {lintResults.orphanPages.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase mb-1">Orphan Pages (no sources)</p>
                  {lintResults.orphanPages.map((p) => (
                    <button key={p.id} onClick={() => navigateToPage(p.id)} className="block text-xs text-red-500 hover:underline">{p.title}</button>
                  ))}
                </div>
              )}
              {lintResults.lowCoveragePages.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase mb-1">Low Coverage</p>
                  {lintResults.lowCoveragePages.map((p) => (
                    <button key={p.id} onClick={() => navigateToPage(p.id)} className="block text-xs text-yellow-600 dark:text-yellow-400 hover:underline">{p.title}</button>
                  ))}
                </div>
              )}
              {lintResults.disconnectedPages.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase mb-1">Disconnected (no related pages)</p>
                  {lintResults.disconnectedPages.map((p) => (
                    <button key={p.id} onClick={() => navigateToPage(p.id)} className="block text-xs text-zinc-500 hover:underline">{p.title}</button>
                  ))}
                </div>
              )}
              {lintResults.orphanPages.length === 0 && lintResults.lowCoveragePages.length === 0 && lintResults.disconnectedPages.length === 0 && (
                <p className="text-xs text-green-600 dark:text-green-400">All checks passed. Wiki is healthy.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Body: sidebar + viewer */}
      <div className="flex flex-1 min-h-0">
        {/* Page list sidebar */}
        <div className="w-52 flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] overflow-auto bg-black/[0.02] dark:bg-white/[0.01]">
          {loading ? (
            <div className="p-4 text-xs text-zinc-400 dark:text-zinc-500">Loading...</div>
          ) : filteredPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center p-6">
              <FileText className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mb-3" />
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                No {filterType === 'all' ? '' : filterType} pages found.
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredPages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => setSelectedId(page.id)}
                  className={`w-full text-left px-3 py-2.5 transition-colors ${
                    selectedId === page.id
                      ? 'bg-indigo-50/50 dark:bg-indigo-500/[0.06] border-r-2 border-indigo-500 dark:border-indigo-400'
                      : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{page.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[page.pageType]}`}>
                      {page.pageType}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      page.coverage === 'high' ? 'bg-green-500' : page.coverage === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} title={`${page.coverage} coverage`} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Page viewer */}
        <div className="flex-1 min-w-0 overflow-auto">
          {selectedPage ? (
            <div className="p-6 max-w-3xl">
              {/* Page title and badges */}
              <div className="mb-6">
                <div className="flex items-start gap-3 mb-3">
                  <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex-1">
                    {selectedPage.title}
                  </h1>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${TYPE_COLORS[selectedPage.pageType]}`}>
                    {selectedPage.pageType}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${COVERAGE_COLORS[selectedPage.coverage]}`}>
                    {selectedPage.coverage} coverage
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Confidence</span>
                    <div className="w-24 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.round(selectedPage.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                      {Math.round(selectedPage.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div
                className="prose prose-sm dark:prose-invert prose-zinc max-w-none mb-6"
                dangerouslySetInnerHTML={{ __html: selectedPage.content }}
              />

              {/* Tags */}
              {selectedPage.tags.length > 0 && (
                <div className="mb-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1"><Tag size={10} /> Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPage.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources */}
              {selectedPage.sourceIds.length > 0 && (
                <div className="mb-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1"><FileText size={10} /> Sources ({selectedPage.sourceIds.length})</p>
                  <div className="space-y-1">
                    {selectedPage.sourceIds.map((sid) => (
                      <div key={sid} className="text-xs px-3 py-1.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] text-zinc-600 dark:text-zinc-400 font-mono truncate">{sid}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Pages */}
              {selectedPage.relatedPages.length > 0 && (
                <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Link2 size={10} /> Related Pages
                  </p>
                  <div className="space-y-1">
                    {selectedPage.relatedPages.map((rpId) => {
                      const rp = pages.find((p) => p.id === rpId)
                      return (
                        <button
                          key={rpId}
                          onClick={() => navigateToPage(rpId)}
                          className="w-full text-left px-3 py-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors border border-black/[0.04] dark:border-white/[0.04]"
                        >
                          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {rp?.title ?? rpId}
                          </p>
                          {rp && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[rp.pageType]}`}>
                              {rp.pageType}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <BookOpen className="w-10 h-10 text-zinc-400 dark:text-zinc-500 mb-4" />
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Select a page
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Choose a wiki page from the list to view its content.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
