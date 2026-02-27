import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq, and, like } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'

/** Extract #tags from note content (same logic as renderer tagParser) */
function extractTags(content: string): string[] {
  const matches = content.match(/#[a-zA-Z][a-zA-Z0-9_-]*/g)
  if (!matches) return []
  const unique = new Set(matches.map((t) => t.toLowerCase()))
  return Array.from(unique)
}

export function registerNoteHandlers() {
  ipcMain.handle(IPC_CHANNELS.NOTES_LIST, async (_event, notebookId: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.notebookId, notebookId))
  })

  ipcMain.handle(IPC_CHANNELS.NOTES_CREATE, async (_event, args: {
    notebookId: string
    title: string
    content: string
  }) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = randomUUID()
    const tags = extractTags(args.content)

    const note = {
      id,
      notebookId: args.notebookId,
      sourceId: null,
      title: args.title,
      content: args.content,
      tags: tags as unknown as string,
      isConvertedToSource: false,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(schema.notes).values(note)
    return { ...note, tags }
  })

  ipcMain.handle(IPC_CHANNELS.NOTES_UPDATE, async (_event, id: string, data: Record<string, unknown>) => {
    const db = getDatabase()
    const now = new Date().toISOString()

    // Auto-extract tags when content changes
    const updates: Record<string, unknown> = { ...data, updatedAt: now }
    if (typeof data.content === 'string') {
      updates.tags = extractTags(data.content)
    }

    await db
      .update(schema.notes)
      .set(updates)
      .where(eq(schema.notes.id, id))
    const rows = await db.select().from(schema.notes).where(eq(schema.notes.id, id))
    return rows[0]
  })

  ipcMain.handle(IPC_CHANNELS.NOTES_DELETE, async (_event, id: string) => {
    const db = getDatabase()
    await db.delete(schema.notes).where(eq(schema.notes.id, id))
  })

  // Aggregate tags across all notes in a notebook
  ipcMain.handle(IPC_CHANNELS.NOTES_TAGS, async (_event, notebookId: string) => {
    const db = getDatabase()
    const notes = await db
      .select({ tags: schema.notes.tags })
      .from(schema.notes)
      .where(eq(schema.notes.notebookId, notebookId))

    const tagCounts = new Map<string, number>()
    for (const note of notes) {
      const tags = (Array.isArray(note.tags) ? note.tags : JSON.parse(String(note.tags) || '[]')) as string[]
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  })

  // Find notes that link to a given note title via [[noteTitle]]
  ipcMain.handle(IPC_CHANNELS.NOTES_BACKLINKS, async (_event, args: { notebookId: string; noteTitle: string }) => {
    const db = getDatabase()
    const pattern = `%[[${args.noteTitle}]]%`
    const notes = await db
      .select({ id: schema.notes.id, title: schema.notes.title, content: schema.notes.content })
      .from(schema.notes)
      .where(and(
        eq(schema.notes.notebookId, args.notebookId),
        like(schema.notes.content, pattern)
      ))

    return notes.map((note) => {
      // Extract ~50 chars of context around the [[link]]
      const linkPattern = `[[${args.noteTitle}]]`
      const idx = note.content.indexOf(linkPattern)
      const start = Math.max(0, idx - 30)
      const end = Math.min(note.content.length, idx + linkPattern.length + 30)
      const snippet = (start > 0 ? '...' : '') + note.content.slice(start, end) + (end < note.content.length ? '...' : '')
      return { id: note.id, title: note.title, snippet }
    })
  })

  // Resolve a [[link title]] to a note id
  ipcMain.handle(IPC_CHANNELS.NOTES_RESOLVE_LINK, async (_event, args: { notebookId: string; linkTitle: string }) => {
    const db = getDatabase()
    const notes = await db
      .select({ id: schema.notes.id, title: schema.notes.title })
      .from(schema.notes)
      .where(eq(schema.notes.notebookId, args.notebookId))

    const match = notes.find((n) => n.title.toLowerCase() === args.linkTitle.toLowerCase())
    return match ? { id: match.id, title: match.title } : null
  })
}
