import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db'
import { embeddingsService } from './embeddings'
import { vectorStoreService } from './vectorStore'
import type { SourceRecommendation } from '../../shared/types'

export class RecommendationsService {
  /**
   * Find related sources across other notebooks.
   * Gets the source's chunks, computes average embedding,
   * then searches across other notebooks.
   */
  async findRelatedSources(
    notebookId: string,
    sourceId: string,
    limit: number = 5
  ): Promise<SourceRecommendation[]> {
    const db = getDatabase()

    // Get the source's content to compute a representative embedding
    const sources = await db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.id, sourceId))

    const source = sources[0]
    if (!source || !source.content) return []

    // Embed a representative sample of the source content
    const sampleText = source.content.slice(0, 2000)
    const queryVector = await embeddingsService.embedQuery(sampleText)

    // Get all notebooks except the current one
    const allNotebooks = await db.select().from(schema.notebooks)
    const otherNotebookIds = allNotebooks
      .filter((nb) => nb.id !== notebookId)
      .map((nb) => nb.id)

    if (otherNotebookIds.length === 0) return []

    // Search across other notebooks
    const results = await vectorStoreService.searchMultiple(
      otherNotebookIds,
      queryVector,
      limit * 3 // Over-fetch to allow deduplication by source
    )

    // Deduplicate by sourceId — take the best score per source
    const bestBySource = new Map<string, typeof results[0]>()
    for (const r of results) {
      const existing = bestBySource.get(r.sourceId)
      if (!existing || r.score > existing.score) {
        bestBySource.set(r.sourceId, r)
      }
    }

    // Look up source titles and notebook titles
    const deduped = Array.from(bestBySource.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    // Build title maps
    const notebookMap = new Map(allNotebooks.map((nb) => [nb.id, nb.title]))

    const allSources = await db.select().from(schema.sources)
    const sourceMap = new Map(allSources.map((s) => [s.id, s.title]))

    return deduped.map((r) => ({
      notebookId: r.notebookId,
      notebookTitle: notebookMap.get(r.notebookId) ?? 'Unknown Notebook',
      sourceId: r.sourceId,
      sourceTitle: sourceMap.get(r.sourceId) ?? 'Unknown Source',
      score: r.score,
    }))
  }
}

export const recommendationsService = new RecommendationsService()
