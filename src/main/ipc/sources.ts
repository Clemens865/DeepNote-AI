import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { vectorStoreService } from '../services/vectorStore'
import { ingestSource } from '../services/sourceIngestion'
import { recommendationsService } from '../services/recommendations'
import { deepbrainService } from '../services/deepbrain'
import { configService } from '../services/config'
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
    const source = await ingestSource({
      notebookId: args.notebookId,
      type: args.type as SourceType,
      filePath: args.filePath,
      content: args.content,
      title: args.title,
      url: args.url,
    })

    // Fire-and-forget: store source addition in DeepBrain (if enabled)
    if (configService.getAll().deepbrainEnabled !== false) {
      const preview = (source.content || '').slice(0, 200)
      deepbrainService.remember(
        `[DeepNote Source] Added "${source.title}" (${source.type}) to notebook ${args.notebookId}. Preview: ${preview}`,
        'semantic',
        0.4
      ).catch((err) => console.warn('[Sources] DeepBrain remember failed:', err))
    }

    return source
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

  // Source Recommendations — find related sources across notebooks
  ipcMain.handle(
    IPC_CHANNELS.SOURCES_RECOMMENDATIONS,
    async (_event, args: { notebookId: string; sourceId: string; limit?: number }) => {
      return recommendationsService.findRelatedSources(
        args.notebookId,
        args.sourceId,
        args.limit ?? 5
      )
    }
  )
}
