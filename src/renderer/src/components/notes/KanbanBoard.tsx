import { useState, useEffect, useCallback, useMemo, DragEvent } from 'react'
import { useNotebookStore } from '../../stores/notebookStore'
import { useAppStore } from '../../stores/appStore'
import { Plus, Hash, GripVertical } from 'lucide-react'
import type { Note } from '@shared/types'

/** Parse tags from a note's tags field */
function parseTags(tags: string | string[]): string[] {
  if (Array.isArray(tags)) return tags
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Strip HTML tags for snippet display */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

interface KanbanColumn {
  id: string
  label: string
  tag: string | null // null = Inbox (untagged)
}

export function KanbanBoard() {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const [notes, setNotes] = useState<Note[]>([])
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [showNewCol, setShowNewCol] = useState(false)
  const [newColName, setNewColName] = useState('')

  const notebookId = currentNotebook?.id

  const loadNotes = useCallback(async () => {
    if (!notebookId) return
    const fetched = await window.api.listNotes(notebookId)
    setNotes(fetched as Note[])
  }, [notebookId])

  // Build columns from tags
  useEffect(() => {
    const tagSet = new Set<string>()
    for (const note of notes) {
      const tags = parseTags(note.tags)
      for (const t of tags) tagSet.add(t.replace(/^#/, '').toLowerCase())
    }
    const tagCols: KanbanColumn[] = Array.from(tagSet)
      .sort()
      .map((t) => ({ id: `tag-${t}`, label: `#${t}`, tag: t }))
    setColumns([{ id: 'inbox', label: 'Inbox', tag: null }, ...tagCols])
  }, [notes])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // Group notes by primary tag (first tag)
  const notesByColumn = useMemo(() => {
    const map = new Map<string, Note[]>()
    for (const col of columns) map.set(col.id, [])

    for (const note of notes) {
      const tags = parseTags(note.tags).map((t) => t.replace(/^#/, '').toLowerCase())
      if (tags.length === 0) {
        map.get('inbox')?.push(note)
      } else {
        const colId = `tag-${tags[0]}`
        if (map.has(colId)) {
          map.get(colId)!.push(note)
        } else {
          map.get('inbox')?.push(note)
        }
      }
    }
    return map
  }, [notes, columns])

  const handleDragStart = (e: DragEvent, noteId: string) => {
    e.dataTransfer.setData('application/x-note-id', noteId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent, colId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colId)
  }

  const handleDragLeave = () => {
    setDragOverCol(null)
  }

  const handleDrop = async (e: DragEvent, targetCol: KanbanColumn) => {
    e.preventDefault()
    setDragOverCol(null)
    const noteId = e.dataTransfer.getData('application/x-note-id')
    if (!noteId) return

    const note = notes.find((n) => n.id === noteId)
    if (!note) return

    const currentTags = parseTags(note.tags).map((t) => t.replace(/^#/, '').toLowerCase())
    const primaryTag = currentTags[0] || null

    // Skip if dropping in same column
    if (targetCol.tag === primaryTag) return
    if (targetCol.tag === null && !primaryTag) return

    // Build new content: remove old primary tag from content, add new one
    let newContent = note.content
    if (primaryTag) {
      // Remove the old primary #tag from content
      const tagRegex = new RegExp(`#${primaryTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      newContent = newContent.replace(tagRegex, '').trim()
    }
    if (targetCol.tag) {
      // Add new tag at start of content
      newContent = `#${targetCol.tag} ${newContent}`
    }

    await window.api.updateNote(noteId, { content: newContent })
    await loadNotes()
  }

  const handleCardClick = (_noteId: string) => {
    // Switch to notes view — the NotesPanel will handle note selection
    setActiveView('notes')
  }

  const handleAddColumn = async () => {
    const name = newColName.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')
    if (!name) return
    // Just adding the tag name — it will appear as a column once a note has it
    // For now, add a placeholder column
    setColumns((prev) => {
      if (prev.some((c) => c.tag === name)) return prev
      return [...prev, { id: `tag-${name}`, label: `#${name}`, tag: name }]
    })
    setNewColName('')
    setShowNewCol(false)
  }

  if (!notebookId) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-500 text-sm">
        Select a notebook to view the Kanban board
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Kanban Board</h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            {notes.length} note{notes.length !== 1 ? 's' : ''} across {columns.length} column{columns.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNewCol(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
        >
          <Plus size={14} />
          Add Column
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-4 h-full min-w-min">
          {columns.map((col) => {
            const colNotes = notesByColumn.get(col.id) || []
            const isOver = dragOverCol === col.id
            return (
              <div
                key={col.id}
                className={`flex flex-col w-[280px] flex-shrink-0 rounded-xl border transition-colors ${
                  isOver
                    ? 'border-indigo-500/40 bg-indigo-500/[0.03] dark:bg-indigo-500/[0.05]'
                    : 'border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]'
                }`}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    {col.tag ? (
                      <Hash size={13} className="text-indigo-500/70" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded bg-zinc-300 dark:bg-zinc-600" />
                    )}
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {col.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 bg-black/[0.04] dark:bg-white/[0.04] px-1.5 py-0.5 rounded-full">
                    {colNotes.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {colNotes.map((note) => {
                    const tags = parseTags(note.tags).map((t) => t.replace(/^#/, ''))
                    const snippet = stripHtml(note.content).slice(0, 80)
                    return (
                      <div
                        key={note.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, note.id)}
                        onClick={() => handleCardClick(note.id)}
                        className="group px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-900/80 border border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-500/30 cursor-pointer transition-all hover:shadow-sm"
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical size={12} className="text-zinc-300 dark:text-zinc-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                              {note.title}
                            </p>
                            {snippet && (
                              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                                {snippet}
                              </p>
                            )}
                            {tags.length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                {tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-black/[0.04] dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400"
                                  >
                                    <Hash size={7} />
                                    {tag}
                                  </span>
                                ))}
                                {tags.length > 3 && (
                                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500">+{tags.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {colNotes.length === 0 && (
                    <div className="flex items-center justify-center py-6 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                      Drop notes here
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* New column inline form */}
          {showNewCol && (
            <div className="flex flex-col w-[280px] flex-shrink-0 rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/[0.02] dark:bg-indigo-500/[0.03] p-3">
              <input
                type="text"
                autoFocus
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddColumn()
                  if (e.key === 'Escape') { setShowNewCol(false); setNewColName('') }
                }}
                placeholder="Tag name..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAddColumn}
                  className="flex-1 py-1.5 text-[11px] font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowNewCol(false); setNewColName('') }}
                  className="flex-1 py-1.5 text-[11px] font-medium rounded-lg bg-black/[0.05] dark:bg-white/[0.05] text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.08] dark:hover:bg-white/[0.08] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
