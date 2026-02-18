import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { embeddingsService } from '../services/embeddings'
import { vectorStoreService } from '../services/vectorStore'
import { superbrainService } from '../services/superbrain'

export function registerSearchHandlers() {
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_GLOBAL,
    async (_event, args: { query: string; notebookIds?: string[]; limit?: number }) => {
      const db = getDatabase()
      const limit = args.limit || 10

      // Get all notebooks if no specific IDs provided
      let notebookIds = args.notebookIds
      if (!notebookIds || notebookIds.length === 0) {
        const notebooks = await db.select().from(schema.notebooks)
        notebookIds = notebooks.map((nb) => nb.id)
      }

      if (notebookIds.length === 0) {
        return { results: [], systemResults: { memories: [], files: [] } }
      }

      // Search notebook vectors AND SuperBrain in parallel
      const [queryVector, sbMemories, sbFiles] = await Promise.all([
        embeddingsService.embedQuery(args.query),
        superbrainService.recall(args.query, 5).catch(() => []),
        superbrainService.searchFiles(args.query, 5).catch(() => []),
      ])

      // Search across all notebooks
      const vectorResults = await vectorStoreService.searchMultiple(notebookIds, queryVector, limit)

      // Build lookup maps for notebook and source titles
      const notebooks = await db.select().from(schema.notebooks)
      const notebookMap = new Map(notebooks.map((nb) => [nb.id, nb.title]))

      const sources = await db.select().from(schema.sources)
      const sourceMap = new Map(sources.map((s) => [s.id, s.title]))

      const results = vectorResults.map((r) => ({
        notebookId: r.notebookId,
        notebookTitle: notebookMap.get(r.notebookId) || 'Unknown Notebook',
        sourceId: r.sourceId,
        sourceTitle: sourceMap.get(r.sourceId) || 'Unknown Source',
        text: r.text.slice(0, 300),
        score: r.score,
        pageNumber: r.pageNumber,
      }))

      return {
        results,
        systemResults: {
          memories: sbMemories.map((m) => ({
            content: m.content,
            memoryType: m.memoryType,
            similarity: m.similarity,
          })),
          files: sbFiles.map((f) => ({
            path: f.path,
            name: f.name,
            chunk: f.chunk.slice(0, 300),
            similarity: f.similarity,
            fileType: f.fileType,
          })),
        },
      }
    }
  )
}
