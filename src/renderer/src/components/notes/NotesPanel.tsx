import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNotebookStore } from '../../stores/notebookStore'
import { NoteEditor } from './NoteEditor'
import { TagBrowser } from './TagBrowser'
import { StickyNote, Plus, X } from 'lucide-react'
import type { Note } from '@shared/types'
import { extractTags } from '../../utils/tagParser'

export function NotesPanel() {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const setSources = useNotebookStore((s) => s.setSources)
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
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

  // Compute tag counts across all notes
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const note of notes) {
      const tags = Array.isArray(note.tags) ? note.tags : extractTags(note.content)
      for (const tag of tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  }, [notes])

  // Filter notes by selected tag
  const filteredNotes = useMemo(() => {
    if (!selectedTag) return notes
    return notes.filter((note) => {
      const tags = Array.isArray(note.tags) ? note.tags : extractTags(note.content)
      return tags.includes(selectedTag)
    })
  }, [notes, selectedTag])

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

    // Compute tags locally when content changes
    const updates: Partial<Note> = { [field]: value, updatedAt: new Date().toISOString() }
    if (field === 'content') {
      updates.tags = extractTags(value)
    }

    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedNote.id ? { ...n, ...updates } : n
      )
    )
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      window.api.updateNote(selectedNote.id, { [field]: value })
    }, 500)
  }

  // Navigate to a note by title (for [[links]])
  const handleNavigateToNote = (noteTitle: string) => {
    const target = notes.find((n) => n.title.toLowerCase() === noteTitle.toLowerCase())
    if (target) {
      setSelectedId(target.id)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notes</h2>
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 text-xs rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all flex items-center gap-1 font-medium shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          New note
        </button>
      </div>

      {/* Tag Browser */}
      <TagBrowser tags={tagCounts} selectedTag={selectedTag} onSelectTag={setSelectedTag} />

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Note list sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] overflow-auto bg-black/[0.02] dark:bg-white/[0.01]">
          {loading && notes.length === 0 ? (
            <div className="p-4 text-xs text-zinc-400 dark:text-zinc-500">Loading...</div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <StickyNote className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mb-3" />
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {notes.length === 0
                  ? 'No notes yet. Click "New note" to get started.'
                  : selectedTag
                    ? `No notes with tag ${selectedTag}`
                    : 'No notes found.'}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredNotes.map((note) => {
                const noteTags = Array.isArray(note.tags) ? note.tags : extractTags(note.content)
                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedId(note.id)}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer group transition-colors ${
                      selectedId === note.id
                        ? 'bg-indigo-50/50 dark:bg-indigo-500/[0.06] border-r-2 border-indigo-500 dark:border-indigo-400'
                        : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">
                        {note.title || 'Untitled note'}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                        {note.content.slice(0, 50) || 'Empty note'}
                      </p>
                      {noteTags.length > 0 && (
                        <div className="flex gap-0.5 mt-1 flex-wrap">
                          {noteTags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[8px] px-1 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
                              {tag}
                            </span>
                          ))}
                          {noteTags.length > 3 && (
                            <span className="text-[8px] text-zinc-400">+{noteTags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(note.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 ml-2 w-5 h-5 rounded flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-red-500 transition-all"
                      title="Delete note"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
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
              onNavigateToNote={handleNavigateToNote}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <StickyNote className="w-10 h-10 text-zinc-400 dark:text-zinc-500 mb-4" />
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                {notes.length === 0 ? 'Create your first note' : 'Select a note'}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
