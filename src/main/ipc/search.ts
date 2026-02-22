import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { embeddingsService } from '../services/embeddings'
import { vectorStoreService } from '../services/vectorStore'
import { deepbrainService } from '../services/deepbrain'
import { configService } from '../services/config'
import { spotlightSearch } from '../services/spotlight'

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
        return { results: [], systemResults: { memories: [], files: [], emails: [], spotlight: [] } }
      }

      // Search notebook vectors, DeepBrain, and Spotlight in parallel
      const sbEnabled = configService.getAll().deepbrainEnabled !== false
      const [queryVector, sbMemories, sbFiles, sbEmails, spotlightResults] = await Promise.all([
        embeddingsService.embedQuery(args.query),
        sbEnabled ? deepbrainService.recall(args.query, 5).catch(() => []) : Promise.resolve([]),
        sbEnabled ? deepbrainService.searchFiles(args.query, 5).catch(() => []) : Promise.resolve([]),
        sbEnabled ? deepbrainService.searchEmails(args.query, 5).catch(() => []) : Promise.resolve([]),
        spotlightSearch(args.query, 8),
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
          emails: sbEmails.map((e) => ({
            subject: e.subject,
            sender: e.sender,
            date: e.date,
            chunk: e.chunk.slice(0, 300),
            similarity: e.similarity,
          })),
          spotlight: spotlightResults,
        },
      }
    }
  )
}
