import { useState, useEffect, useCallback, useRef } from 'react'
import { useNotebookStore } from '../../stores/notebookStore'
import { NoteEditor } from './NoteEditor'
import { StickyNote, Plus, X } from 'lucide-react'
import type { Note } from '@shared/types'

export function NotesPanel() {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const setSources = useNotebookStore((s) => s.setSources)
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadNotes = useCallback(async () => {
    if (!currentNotebook) return
    setLoading(true)
    const result = (await window.api.listNotes(currentNotebook.id)) as Note[]
    setNotes(result)
    setLoading(false)
  }, [currentNotebook])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null

  const handleCreate = async () => {
    if (!currentNotebook) return
    const note = (await window.api.createNote({
      notebookId: currentNotebook.id,
      title: 'Untitled note',
      content: '',
    })) as Note
    setNotes((prev) => [note, ...prev])
    setSelectedId(note.id)
  }

  const handleDelete = async (noteId: string) => {
    if (!confirm('Delete this note?')) return
    await window.api.deleteNote(noteId)
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
    if (selectedId === noteId) setSelectedId(null)
  }

  const handleConvertToSource = async () => {
    if (!selectedNote || !currentNotebook || !selectedNote.content.trim()) return
    try {
      await window.api.addSource({
        notebookId: currentNotebook.id,
        type: 'paste',
        content: selectedNote.content,
        title: selectedNote.title || 'Note',
      })
      await window.api.updateNote(selectedNote.id, { isConvertedToSource: true })
      setNotes((prev) =>
        prev.map((n) =>
          n.id === selectedNote.id ? { ...n, isConvertedToSource: true } : n
        )
      )
      const sources = await window.api.listSources(currentNotebook.id)
      setSources(sources as never[])
    } catch (err) {
      console.error('Failed to convert note to source:', err)
    }
  }

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNoteChange = (field: 'title' | 'content', value: string) => {
    if (!selectedNote) return
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedNote.id ? { ...n, [field]: value, updatedAt: new Date().toISOString() } : n
      )
    )
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      window.api.updateNote(selectedNote.id, { [field]: value })
    }, 500)
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notes</h2>
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors flex items-center gap-1 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          New note
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Note list sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-auto bg-slate-50 dark:bg-slate-800/50">
          {loading && notes.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 dark:text-slate-500">Loading...</div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <StickyNote className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-3" />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                No notes yet. Click &quot;New note&quot; to get started.
              </p>
            </div>
          ) : (
            <div className="py-1">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setSelectedId(note.id)}
                  className={`flex items-center justify-between px-3 py-2.5 cursor-pointer group transition-colors ${
                    selectedId === note.id
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border-r-2 border-indigo-600 dark:border-indigo-400'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                      {note.title || 'Untitled note'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {note.content.slice(0, 50) || 'Empty note'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(note.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-2 w-5 h-5 rounded flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500 transition-all"
                    title="Delete note"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor area */}
        <div className="flex-1 min-w-0">
          {selectedNote ? (
            <NoteEditor
              note={selectedNote}
              onTitleChange={(v) => handleNoteChange('title', v)}
              onContentChange={(v) => handleNoteChange('content', v)}
              onConvertToSource={handleConvertToSource}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <StickyNote className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {notes.length === 0 ? 'Create your first note' : 'Select a note'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {notes.length === 0
                  ? 'Click "New note" to start writing.'
                  : 'Choose a note from the list to view and edit it.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
