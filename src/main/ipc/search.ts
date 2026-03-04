import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { embeddingsService } from '../services/embeddings'
import { vectorStoreService } from '../services/vectorStore'
import { knowledgeStoreService } from '../services/knowledgeStore'
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

      // Search notebook vectors, Knowledge store, and Spotlight in parallel
      const knowledgeEnabled = configService.getAll().knowledgeEnabled !== false
      const [queryVector, knowledgeResults, spotlightResults] = await Promise.all([
        embeddingsService.embedQuery(args.query),
        knowledgeEnabled ? knowledgeStoreService.search(args.query, 5).catch(() => []) : Promise.resolve([]),
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
          memories: knowledgeResults.map((m) => ({
            content: m.content,
            memoryType: m.type,
            similarity: m.similarity,
          })),
          files: [],
          emails: [],
          spotlight: spotlightResults,
        },
      }
    }
  )
}
