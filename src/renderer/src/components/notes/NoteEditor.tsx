import type { Note } from '@shared/types'

interface NoteEditorProps {
  note: Note
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onConvertToSource?: () => void
}

export function NoteEditor({ note, onTitleChange, onContentChange, onConvertToSource }: NoteEditorProps) {
  const updatedDate = new Date(note.updatedAt)
  const timeStr = updatedDate.toLocaleString()

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-1">
        <input
          type="text"
          value={note.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Note title..."
          className="text-lg font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-none outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 flex-1"
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
              className="px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Convert to Source
            </button>
          )
        )}
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Last edited {timeStr}</p>
      <textarea
        value={note.content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Start writing..."
        className="flex-1 text-sm text-slate-700 dark:text-slate-200 bg-transparent border-none outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500 leading-relaxed"
      />
    </div>
  )
}
