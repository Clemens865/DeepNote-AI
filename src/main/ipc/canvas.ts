import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'

export function registerCanvasHandlers() {
  ipcMain.handle(IPC_CHANNELS.CANVAS_LIST, async (_event, notebookId: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.canvases)
      .where(eq(schema.canvases.notebookId, notebookId))
  })

  ipcMain.handle(IPC_CHANNELS.CANVAS_CREATE, async (_event, args: {
    notebookId: string
    title?: string
  }) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = randomUUID()

    const canvas = {
      id,
      notebookId: args.notebookId,
      title: args.title ?? 'Untitled Canvas',
      data: {} as unknown as string,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(schema.canvases).values(canvas)
    return { ...canvas, data: {} }
  })

  ipcMain.handle(IPC_CHANNELS.CANVAS_GET, async (_event, id: string) => {
    const db = getDatabase()
    const rows = await db.select().from(schema.canvases).where(eq(schema.canvases.id, id))
    return rows[0] ?? null
  })

  ipcMain.handle(IPC_CHANNELS.CANVAS_UPDATE, async (_event, id: string, data: Record<string, unknown>) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    await db
      .update(schema.canvases)
      .set({ ...data, updatedAt: now })
      .where(eq(schema.canvases.id, id))
    const rows = await db.select().from(schema.canvases).where(eq(schema.canvases.id, id))
    return rows[0]
  })

  ipcMain.handle(IPC_CHANNELS.CANVAS_DELETE, async (_event, id: string) => {
    const db = getDatabase()
    await db.delete(schema.canvases).where(eq(schema.canvases.id, id))
  })
}
