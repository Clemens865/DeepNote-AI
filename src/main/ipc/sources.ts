import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { vectorStoreService } from '../services/vectorStore'
import { ingestSource } from '../services/sourceIngestion'
import type { SourceType } from '../../shared/types'

export function registerSourceHandlers() {
  ipcMain.handle(IPC_CHANNELS.SOURCES_LIST, async (_event, notebookId: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.notebookId, notebookId))
  })

  ipcMain.handle(IPC_CHANNELS.SOURCES_ADD, async (_event, args: {
    notebookId: string
    type: string
    filePath?: string
    content?: string
    title?: string
    url?: string
  }) => {
    return ingestSource({
      notebookId: args.notebookId,
      type: args.type as SourceType,
      filePath: args.filePath,
      content: args.content,
      title: args.title,
      url: args.url,
    })
  })

  ipcMain.handle(IPC_CHANNELS.SOURCES_DELETE, async (_event, id: string) => {
    const db = getDatabase()

    // Get the source to find its notebookId for vector cleanup
    const rows = await db.select().from(schema.sources).where(eq(schema.sources.id, id))
    const source = rows[0]

    if (source) {
      // Clean up vectors
      await vectorStoreService.deleteSource(source.notebookId, id)
    }

    // Delete source (chunks cascade via FK)
    await db.delete(schema.sources).where(eq(schema.sources.id, id))
  })

  ipcMain.handle(IPC_CHANNELS.SOURCES_TOGGLE, async (_event, id: string, isSelected: boolean) => {
    const db = getDatabase()
    await db
      .update(schema.sources)
      .set({ isSelected })
      .where(eq(schema.sources.id, id))
    const rows = await db.select().from(schema.sources).where(eq(schema.sources.id, id))
    return rows[0]
  })
}
