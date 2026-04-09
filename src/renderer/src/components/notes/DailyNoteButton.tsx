import { useState, useCallback } from 'react'
import { CalendarDays, Check } from 'lucide-react'
import type { Note } from '@shared/types'

interface DailyNoteButtonProps {
  notebookId: string
  onNavigateToNote: (noteId: string) => void
  /** List of all notes — used to check if today's daily note already exists */
  notes: Note[]
}

export function DailyNoteButton({ notebookId, onNavigateToNote, notes }: DailyNoteButtonProps) {
  const today = new Date().toISOString().split('T')[0]
  const [loading, setLoading] = useState(false)

  // Check if today's daily note already exists
  const todayNote = notes.find(
    (n) => n.isDailyNote && n.title === today
  )

  const handleClick = useCallback(async () => {
    setLoading(true)
    try {
      const note = (await window.api.notesGetDaily({ notebookId })) as Note
      onNavigateToNote(note.id)
    } catch (err) {
      console.error('Failed to get/create daily note:', err)
    } finally {
      setLoading(false)
    }
  }, [notebookId, onNavigateToNote])

  // Format today's date for display
  const displayDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`relative px-3 py-1.5 text-xs rounded-full transition-all flex items-center gap-1.5 font-medium shadow-sm ${
        todayNote
          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
          : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/15'
      }`}
      title={todayNote ? `Open today's daily note (${today})` : `Create today's daily note (${today})`}
    >
      {todayNote ? (
        <Check className="w-3 h-3" />
      ) : (
        <CalendarDays className="w-3 h-3" />
      )}
      {loading ? 'Loading...' : displayDate}
    </button>
  )
}
