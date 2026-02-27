import { useState, useEffect } from 'react'
import { Link2 } from 'lucide-react'

interface Backlink {
  id: string
  title: string
  snippet: string
}

interface BacklinksPanelProps {
  notebookId: string
  noteTitle: string
  onNavigateToNote: (noteTitle: string) => void
}

export function BacklinksPanel({ notebookId, noteTitle, onNavigateToNote }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!noteTitle.trim()) {
      setBacklinks([])
      return
    }
    setLoading(true)
    window.api
      .notesBacklinks({ notebookId, noteTitle })
      .then((results: Backlink[]) => setBacklinks(results))
      .catch(() => setBacklinks([]))
      .finally(() => setLoading(false))
  }, [notebookId, noteTitle])

  if (loading || backlinks.length === 0) return null

  return (
    <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
      <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1">
        <Link2 size={10} />
        Backlinks ({backlinks.length})
      </p>
      <div className="space-y-1.5">
        {backlinks.map((bl) => (
          <button
            key={bl.id}
            onClick={() => onNavigateToNote(bl.title)}
            className="w-full text-left px-3 py-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors border border-black/[0.04] dark:border-white/[0.04]"
          >
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{bl.title}</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{bl.snippet}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
