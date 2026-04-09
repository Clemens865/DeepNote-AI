import { useState } from 'react'
import type { Note } from '@shared/types'
import { TiptapNoteEditor } from './TiptapNoteEditor'
import { BacklinksPanel } from './BacklinksPanel'
import { AIFeaturesPanel } from './AIFeaturesPanel'

interface NoteEditorProps {
  note: Note
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onConvertToSource?: () => void
  onNavigateToNote?: (noteTitle: string) => void
}

export function NoteEditor({ note, onTitleChange, onContentChange, onConvertToSource, onNavigateToNote }: NoteEditorProps) {
  const [showAIPanel, setShowAIPanel] = useState(false)
  const updatedDate = new Date(note.updatedAt)
  const timeStr = updatedDate.toLocaleString()

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-1">
            <input
              type="text"
              value={note.title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Note title..."
              className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 bg-transparent border-none outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 flex-1"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showAIPanel
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                }`}
                title={showAIPanel ? 'Hide AI Features' : 'Show AI Features'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </button>
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
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Last edited {timeStr}</p>
            {/* Tag chips */}
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
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
          </div>
        </div>

        {/* Tiptap Editor */}
        <div className="flex-1 min-h-0">
          <TiptapNoteEditor
            content={note.content}
            onContentChange={onContentChange}
            onNavigateToNote={onNavigateToNote}
          />
        </div>

        {/* Backlinks */}
        {note.title.trim() && note.notebookId && (
          <div className="px-6 pb-4">
            <BacklinksPanel
              notebookId={note.notebookId}
              noteTitle={note.title}
              onNavigateToNote={(title) => onNavigateToNote?.(title)}
            />
          </div>
        )}
      </div>

      {/* AI Features Panel */}
      {showAIPanel && (
        <AIFeaturesPanel
          note={note}
          onContentUpdate={onContentChange}
        />
      )}
    </div>
  )
}
