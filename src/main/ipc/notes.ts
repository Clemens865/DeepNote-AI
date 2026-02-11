import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'

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

    const note = {
      id,
      notebookId: args.notebookId,
      sourceId: null,
      title: args.title,
      content: args.content,
      isConvertedToSource: false,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(schema.notes).values(note)
    return note
  })

  ipcMain.handle(IPC_CHANNELS.NOTES_UPDATE, async (_event, id: string, data: Record<string, unknown>) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    await db
      .update(schema.notes)
      .set({ ...data, updatedAt: now })
      .where(eq(schema.notes.id, id))
    const rows = await db.select().from(schema.notes).where(eq(schema.notes.id, id))
    return rows[0]
  })

  ipcMain.handle(IPC_CHANNELS.NOTES_DELETE, async (_event, id: string) => {
    const db = getDatabase()
    await db.delete(schema.notes).where(eq(schema.notes.id, id))
  })
}
