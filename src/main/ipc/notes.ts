import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq, and, like, or } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, getSqlite, schema } from '../db'
import { syncTasksFromContent } from './tasks'
import { generateWithValidation } from '../services/aiMiddleware'

const DEFAULT_TEMPLATES = [
  {
    id: 'default-daily-note',
    title: 'Daily Note',
    content: '# {{date}}\n\n## Tasks\n- [ ] \n\n## Notes\n\n## Reflections\n',
    description: 'A daily journal with tasks, notes, and reflections',
    isGlobal: true,
  },
  {
    id: 'default-meeting-notes',
    title: 'Meeting Notes',
    content: '# Meeting: {{title}}\n**Date:** {{date}}\n**Attendees:**\n\n## Agenda\n\n## Notes\n\n## Action Items\n- [ ] \n',
    description: 'Structured notes for meetings with agenda and action items',
    isGlobal: true,
  },
  {
    id: 'default-research-note',
    title: 'Research Note',
    content: '# {{title}}\n\n## Key Findings\n\n## Sources\n\n## Questions\n\n## Next Steps\n',
    description: 'Template for research with findings, sources, and next steps',
    isGlobal: true,
  },
]

async function seedDefaultTemplates() {
  const db = getDatabase()
  const existing = await db.select({ id: schema.noteTemplates.id }).from(schema.noteTemplates).where(eq(schema.noteTemplates.isGlobal, true))
  if (existing.length > 0) return

  const now = new Date().toISOString()
  for (const tpl of DEFAULT_TEMPLATES) {
    await db.insert(schema.noteTemplates).values({
      ...tpl,
      notebookId: null,
      createdAt: now,
      updatedAt: now,
    })
  }
}

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
    const note = rows[0]

    // Sync tasks from content when content changes
    if (note && typeof data.content === 'string') {
      syncTasksFromContent(note.id, note.notebookId, data.content).catch((err) =>
        console.error('Failed to sync tasks:', err)
      )
    }

    return note
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

  // Full-text search across notes in a notebook (FTS5)
  ipcMain.handle(IPC_CHANNELS.NOTES_SEARCH, async (_event, args: { notebookId: string; query: string }) => {
    const rawDb = getSqlite()
    if (!rawDb) return []

    // Sanitize query for FTS5: wrap each token in double quotes to avoid syntax errors
    const sanitized = args.query
      .replace(/['"]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((tok) => `"${tok}"`)
      .join(' ')

    if (!sanitized) return []

    try {
      const results = rawDb.prepare(`
        SELECT n.* FROM notes n
        JOIN notes_fts ON notes_fts.rowid = n.rowid
        WHERE notes_fts MATCH ? AND n.notebook_id = ?
        ORDER BY rank
        LIMIT 50
      `).all(sanitized, args.notebookId)
      return results
    } catch {
      // Fallback to LIKE if FTS query fails (e.g. special characters)
      const db = getDatabase()
      const pattern = `%${args.query}%`
      return db
        .select()
        .from(schema.notes)
        .where(
          and(
            eq(schema.notes.notebookId, args.notebookId),
            or(
              like(schema.notes.title, pattern),
              like(schema.notes.content, pattern)
            )
          )
        )
    }
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

  // Move a note to a folder (or root if folderId is null)
  ipcMain.handle(IPC_CHANNELS.NOTES_MOVE_TO_FOLDER, async (_event, args: { noteId: string; folderId: string | null }) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    await db
      .update(schema.notes)
      .set({ folderId: args.folderId, updatedAt: now })
      .where(eq(schema.notes.id, args.noteId))
    const rows = await db.select().from(schema.notes).where(eq(schema.notes.id, args.noteId))
    return rows[0]
  })

  // --- Daily Notes ---

  ipcMain.handle(IPC_CHANNELS.NOTES_GET_DAILY, async (_event, args: { notebookId: string }) => {
    const db = getDatabase()
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // Check if a daily note already exists for today
    const existing = await db
      .select()
      .from(schema.notes)
      .where(
        and(
          eq(schema.notes.notebookId, args.notebookId),
          eq(schema.notes.isDailyNote, true),
          eq(schema.notes.title, today)
        )
      )

    if (existing.length > 0) return existing[0]

    // Get the Daily Note template
    const templates = await db
      .select()
      .from(schema.noteTemplates)
      .where(eq(schema.noteTemplates.id, 'default-daily-note'))

    const template = templates[0]
    const content = template
      ? template.content.replace(/\{\{date\}\}/g, today)
      : `# ${today}\n\n## Tasks\n- [ ] \n\n## Notes\n\n## Reflections\n`

    const now = new Date().toISOString()
    const id = randomUUID()
    const tags = extractTags(content)

    const note = {
      id,
      notebookId: args.notebookId,
      sourceId: null,
      folderId: null,
      title: today,
      content,
      tags: tags as unknown as string,
      isConvertedToSource: false,
      isDailyNote: true,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(schema.notes).values(note)
    return { ...note, tags }
  })

  // --- Note Templates ---

  ipcMain.handle(IPC_CHANNELS.NOTE_TEMPLATES_LIST, async (_event, args: { notebookId?: string }) => {
    await seedDefaultTemplates()
    const db = getDatabase()

    if (args.notebookId) {
      return db
        .select()
        .from(schema.noteTemplates)
        .where(
          or(
            eq(schema.noteTemplates.isGlobal, true),
            eq(schema.noteTemplates.notebookId, args.notebookId)
          )
        )
    }

    return db
      .select()
      .from(schema.noteTemplates)
      .where(eq(schema.noteTemplates.isGlobal, true))
  })

  ipcMain.handle(IPC_CHANNELS.NOTE_TEMPLATES_CREATE, async (_event, args: {
    notebookId?: string
    title: string
    content: string
    description?: string
    isGlobal?: boolean
  }) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = randomUUID()

    const template = {
      id,
      notebookId: args.notebookId ?? null,
      title: args.title,
      content: args.content,
      description: args.description ?? '',
      isGlobal: args.isGlobal ?? false,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(schema.noteTemplates).values(template)
    return template
  })

  ipcMain.handle(IPC_CHANNELS.NOTE_TEMPLATES_UPDATE, async (_event, id: string, data: Record<string, unknown>) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    await db
      .update(schema.noteTemplates)
      .set({ ...data, updatedAt: now })
      .where(eq(schema.noteTemplates.id, id))
    const rows = await db.select().from(schema.noteTemplates).where(eq(schema.noteTemplates.id, id))
    return rows[0]
  })

  ipcMain.handle(IPC_CHANNELS.NOTE_TEMPLATES_DELETE, async (_event, id: string) => {
    const db = getDatabase()
    await db.delete(schema.noteTemplates).where(eq(schema.noteTemplates.id, id))
  })

  // --- Note Folders ---

  ipcMain.handle(IPC_CHANNELS.NOTE_FOLDERS_LIST, async (_event, notebookId: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.noteFolders)
      .where(eq(schema.noteFolders.notebookId, notebookId))
  })

  ipcMain.handle(IPC_CHANNELS.NOTE_FOLDERS_CREATE, async (_event, args: {
    notebookId: string
    name: string
    parentId?: string | null
  }) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = randomUUID()

    const folder = {
      id,
      notebookId: args.notebookId,
      parentId: args.parentId ?? null,
      name: args.name,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(schema.noteFolders).values(folder)
    return folder
  })

  ipcMain.handle(IPC_CHANNELS.NOTE_FOLDERS_UPDATE, async (_event, id: string, data: Record<string, unknown>) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    await db
      .update(schema.noteFolders)
      .set({ ...data, updatedAt: now })
      .where(eq(schema.noteFolders.id, id))
    const rows = await db.select().from(schema.noteFolders).where(eq(schema.noteFolders.id, id))
    return rows[0]
  })

  // --- AI-powered Note Features ---

  // Auto-Tag Suggestions (AI)
  ipcMain.handle(IPC_CHANNELS.NOTES_SUGGEST_TAGS, async (_event, args: {
    notebookId: string
    noteId: string
    content: string
  }) => {
    const prompt = `Given this note content, suggest 3-5 relevant hashtags. Return only a JSON array of strings, no other text.\n\nNote content:\n${args.content}`
    try {
      const result = await generateWithValidation('tags', prompt, [args.content], undefined, 2)
      // generateWithValidation returns a parsed object; if it's an array, use it directly
      if (Array.isArray(result)) {
        return (result as unknown[]).map((t) => String(t).replace(/^#/, ''))
      }
      // If it has a tags field, use that
      if (result.tags && Array.isArray(result.tags)) {
        return (result.tags as unknown[]).map((t) => String(t).replace(/^#/, ''))
      }
      // Fallback: try to extract tag-like words from raw
      if (typeof result.raw === 'string') {
        const matches = (result.raw as string).match(/#?[a-zA-Z][a-zA-Z0-9_-]+/g)
        return matches ? matches.slice(0, 5).map((t) => t.replace(/^#/, '')) : []
      }
      return []
    } catch (err) {
      console.error('[NOTES_SUGGEST_TAGS] error:', err)
      return []
    }
  })

  // Auto-Link Suggestions (string matching, no AI)
  ipcMain.handle(IPC_CHANNELS.NOTES_SUGGEST_LINKS, async (_event, args: {
    notebookId: string
    noteId: string
    content: string
  }) => {
    const db = getDatabase()
    const notes = await db
      .select({ id: schema.notes.id, title: schema.notes.title })
      .from(schema.notes)
      .where(eq(schema.notes.notebookId, args.notebookId))

    const contentLower = args.content.toLowerCase()
    const suggestions: string[] = []

    for (const note of notes) {
      // Skip the note itself, and skip notes with very short titles
      if (note.id === args.noteId || note.title.trim().length < 2) continue
      const titleLower = note.title.toLowerCase()
      // Check if the title appears in content but is NOT already wrapped in [[]]
      if (contentLower.includes(titleLower)) {
        // Verify it's not already linked: look for [[Title]] (case-insensitive)
        const linkedPattern = new RegExp(`\\[\\[${note.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'i')
        if (!linkedPattern.test(args.content)) {
          suggestions.push(note.title)
        }
      }
    }

    return suggestions
  })

  // Note Summarization (AI)
  ipcMain.handle(IPC_CHANNELS.NOTES_SUMMARIZE, async (_event, args: {
    content: string
    length: 'short' | 'medium' | 'long'
  }) => {
    const lengthMap = {
      short: '1-2 sentences',
      medium: 'a paragraph',
      long: '3-4 paragraphs',
    }
    const lengthDesc = lengthMap[args.length]
    const prompt = `Summarize this note in ${lengthDesc}. Return only the summary text, no JSON wrapping, no markdown fences.\n\nNote content:\n${args.content}`

    try {
      const result = await generateWithValidation('summary', prompt, [args.content], undefined, 2)
      // The result may come back as { raw: "..." } since it's not JSON
      if (typeof result.raw === 'string') {
        return result.raw
      }
      // If somehow it parsed as JSON with a summary field
      if (typeof result.summary === 'string') {
        return result.summary
      }
      // If it's a text field
      if (typeof result.text === 'string') {
        return result.text
      }
      // Last resort: stringify
      return JSON.stringify(result)
    } catch (err) {
      console.error('[NOTES_SUMMARIZE] error:', err)
      return 'Failed to generate summary. Please try again.'
    }
  })

  ipcMain.handle(IPC_CHANNELS.NOTE_FOLDERS_DELETE, async (_event, id: string) => {
    const db = getDatabase()
    // Move all notes in this folder back to root
    await db
      .update(schema.notes)
      .set({ folderId: null, updatedAt: new Date().toISOString() })
      .where(eq(schema.notes.folderId, id))
    // Move subfolders to root
    await db
      .update(schema.noteFolders)
      .set({ parentId: null, updatedAt: new Date().toISOString() })
      .where(eq(schema.noteFolders.parentId, id))
    // Delete the folder
    await db.delete(schema.noteFolders).where(eq(schema.noteFolders.id, id))
  })
}
