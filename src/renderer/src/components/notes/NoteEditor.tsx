import type { Note } from '@shared/types'
import { NoteContentRenderer } from './NoteContentRenderer'
import { BacklinksPanel } from './BacklinksPanel'

interface NoteEditorProps {
  note: Note
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onConvertToSource?: () => void
  onNavigateToNote?: (noteTitle: string) => void
}

export function NoteEditor({ note, onTitleChange, onContentChange, onConvertToSource, onNavigateToNote }: NoteEditorProps) {
  const updatedDate = new Date(note.updatedAt)
  const timeStr = updatedDate.toLocaleString()

  const handleLinkClick = (noteTitle: string) => {
    onNavigateToNote?.(noteTitle)
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      <div className="flex items-center justify-between mb-1">
        <input
          type="text"
          value={note.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Note title..."
          className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 bg-transparent border-none outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 flex-1"
        />
        {note.isConvertedToSource ? (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20">
            Converted to source
          </span>
        ) : (
          onConvertToSource && (
            <button
              onClick={onConvertToSource}
              disabled={!note.content.trim()}
              className="px-3 py-1 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Convert to Source
            </button>
          )
        )}
      </div>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Last edited {timeStr}</p>

      {/* Tag chips */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <textarea
        value={note.content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Start writing... Use #tags and [[Note Title]] for links"
        className="flex-1 min-h-[200px] text-sm text-zinc-700 dark:text-zinc-200 bg-transparent border-none outline-none resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 leading-relaxed"
      />

      {/* Rendered note links */}
      <NoteContentRenderer content={note.content} onLinkClick={handleLinkClick} />

      {/* Backlinks */}
      {note.title.trim() && note.notebookId && (
        <BacklinksPanel
          notebookId={note.notebookId}
          noteTitle={note.title}
          onNavigateToNote={handleLinkClick}
        />
      )}
    </div>
  )
}
