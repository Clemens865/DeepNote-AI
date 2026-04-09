import { useState, useCallback } from 'react'
import type { Note } from '@shared/types'

interface AIFeaturesPanelProps {
  note: Note
  onContentUpdate: (newContent: string) => void
}

export function AIFeaturesPanel({ note, onContentUpdate }: AIFeaturesPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Tag suggestions state
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)

  // Link suggestions state
  const [suggestedLinks, setSuggestedLinks] = useState<string[]>([])
  const [linksLoading, setLinksLoading] = useState(false)

  // Summary state
  const [summary, setSummary] = useState('')
  const [summaryLength, setSummaryLength] = useState<'short' | 'medium' | 'long'>('short')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSuggestTags = useCallback(async () => {
    if (!note.content.trim()) return
    setTagsLoading(true)
    setSuggestedTags([])
    try {
      const tags = await window.api.notesSuggestTags({
        notebookId: note.notebookId,
        noteId: note.id,
        content: note.content,
      })
      setSuggestedTags(tags)
    } catch (err) {
      console.error('Failed to suggest tags:', err)
    } finally {
      setTagsLoading(false)
    }
  }, [note.notebookId, note.id, note.content])

  const handleAddTag = useCallback(
    (tag: string) => {
      const hashtag = `#${tag}`
      // Append the tag at the end of the content
      const newContent = note.content.trimEnd() + '\n' + hashtag
      onContentUpdate(newContent)
      // Remove this tag from suggestions
      setSuggestedTags((prev) => prev.filter((t) => t !== tag))
    },
    [note.content, onContentUpdate]
  )

  const handleFindLinks = useCallback(async () => {
    if (!note.content.trim()) return
    setLinksLoading(true)
    setSuggestedLinks([])
    try {
      const links = await window.api.notesSuggestLinks({
        notebookId: note.notebookId,
        noteId: note.id,
        content: note.content,
      })
      setSuggestedLinks(links)
    } catch (err) {
      console.error('Failed to find links:', err)
    } finally {
      setLinksLoading(false)
    }
  }, [note.notebookId, note.id, note.content])

  const handleLinkTitle = useCallback(
    (title: string) => {
      // Replace the first unlinked occurrence of the title with [[title]]
      const regex = new RegExp(
        `(?<!\\[\\[)${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\]\\])`,
        'i'
      )
      const newContent = note.content.replace(regex, `[[${title}]]`)
      onContentUpdate(newContent)
      // Remove from suggestions
      setSuggestedLinks((prev) => prev.filter((t) => t !== title))
    },
    [note.content, onContentUpdate]
  )

  const handleSummarize = useCallback(async () => {
    if (!note.content.trim()) return
    setSummaryLoading(true)
    setSummary('')
    try {
      const result = await window.api.notesSummarize({
        content: note.content,
        length: summaryLength,
      })
      setSummary(result)
    } catch (err) {
      console.error('Failed to summarize:', err)
    } finally {
      setSummaryLoading(false)
    }
  }, [note.content, summaryLength])

  const handleCopySummary = useCallback(async () => {
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [summary])

  const handleInsertAtTop = useCallback(() => {
    const newContent = `> **Summary:** ${summary}\n\n${note.content}`
    onContentUpdate(newContent)
  }, [summary, note.content, onContentUpdate])

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-3">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          title="Expand AI Features"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="w-[250px] flex-shrink-0 border-l border-black/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">AI Features</span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          title="Collapse"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="p-3 space-y-4">
        {/* Auto-Tag Suggestions */}
        <section>
          <button
            onClick={handleSuggestTags}
            disabled={tagsLoading || !note.content.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {tagsLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            )}
            Suggest Tags
          </button>
          {suggestedTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleAddTag(tag)}
                  className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-500/20"
                  title={`Add #${tag} to note`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Link Suggestions */}
        <section>
          <button
            onClick={handleFindLinks}
            disabled={linksLoading || !note.content.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {linksLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
            Find Links
          </button>
          {suggestedLinks.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {suggestedLinks.length} potential link{suggestedLinks.length !== 1 ? 's' : ''} found
              </p>
              {suggestedLinks.map((title) => (
                <button
                  key={title}
                  onClick={() => handleLinkTitle(title)}
                  className="w-full text-left px-2 py-1 text-[11px] rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors truncate border border-emerald-200 dark:border-emerald-500/20"
                  title={`Wrap "${title}" with [[]]`}
                >
                  [[{title}]]
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Summarize */}
        <section>
          <div className="flex gap-1 mb-1.5">
            {(['short', 'medium', 'long'] as const).map((len) => (
              <button
                key={len}
                onClick={() => setSummaryLength(len)}
                className={`flex-1 px-1 py-0.5 text-[10px] rounded transition-colors ${
                  summaryLength === len
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold'
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
                }`}
              >
                {len.charAt(0).toUpperCase() + len.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={handleSummarize}
            disabled={summaryLoading || !note.content.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {summaryLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            Summarize
          </button>
          {summary && (
            <div className="mt-2">
              <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed max-h-40 overflow-y-auto">
                {summary}
              </div>
              <div className="flex gap-1 mt-1.5">
                <button
                  onClick={handleCopySummary}
                  className="flex-1 px-2 py-1 text-[10px] font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleInsertAtTop}
                  className="flex-1 px-2 py-1 text-[10px] font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Insert at Top
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
