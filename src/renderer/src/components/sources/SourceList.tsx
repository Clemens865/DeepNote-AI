import { useState } from 'react'
import type { Source } from '@shared/types'
import { useNotebookStore } from '../../stores/notebookStore'
import { FileText, FileType, FileCode, Link, Play, ClipboardPaste, Music, Trash2 } from 'lucide-react'

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  pdf: FileText,
  docx: FileType,
  txt: FileCode,
  md: FileCode,
  url: Link,
  youtube: Play,
  paste: ClipboardPaste,
  audio: Music,
}

export function SourceList({ sources }: { sources: Source[] }) {
  const setSources = useNotebookStore((s) => s.setSources)
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleToggle = async (source: Source) => {
    await window.api.toggleSource(source.id, !source.isSelected)
    if (currentNotebook) {
      const updated = await window.api.listSources(currentNotebook.id)
      setSources(updated as never[])
    }
  }

  const handleDelete = async (sourceId: string) => {
    if (!confirm('Delete this source? This cannot be undone.')) return
    await window.api.deleteSource(sourceId)
    if (currentNotebook) {
      const updated = await window.api.listSources(currentNotebook.id)
      setSources(updated as never[])
    }
  }

  const handleRowClick = (sourceId: string) => {
    setExpandedId((prev) => (prev === sourceId ? null : sourceId))
  }

  return (
    <div className="space-y-0.5">
      {sources.map((source) => {
        const Icon = TYPE_ICONS[source.type] || FileText
        const isExpanded = expandedId === source.id
        return (
          <div key={source.id}>
            <div
              onClick={() => handleRowClick(source.id)}
              className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
              }`}
            >
              <input
                type="checkbox"
                checked={source.isSelected}
                onChange={(e) => {
                  e.stopPropagation()
                  handleToggle(source)
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded accent-indigo-600 flex-shrink-0"
              />
              <Icon size={14} className={isExpanded ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} />
              <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">
                {source.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(source.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-all"
                title="Delete source"
              >
                <Trash2 size={12} />
              </button>
            </div>
            {isExpanded && (
              <div className="mx-2 mb-1 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {source.sourceGuide || (
                    <span className="text-slate-400 dark:text-slate-500 italic">Generating summary...</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
