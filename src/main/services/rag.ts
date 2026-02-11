import { embeddingsService } from './embeddings'
import { vectorStoreService } from './vectorStore'
import type { Citation } from '../../shared/types'

interface RagResult {
  context: string
  citations: Citation[]
}

export class RagService {
  async query(
    notebookId: string,
    question: string,
    selectedSourceIds?: string[],
    sourceTitleMap?: Record<string, string>
  ): Promise<RagResult> {
    const queryVector = await embeddingsService.embedQuery(question)

    const results = await vectorStoreService.search(
      notebookId,
      queryVector,
      8,
      selectedSourceIds
    )

    if (results.length === 0) {
      return { context: '', citations: [] }
    }

    const citations: Citation[] = results.map((r) => ({
      sourceId: r.sourceId,
      sourceTitle: sourceTitleMap?.[r.sourceId] ?? 'Source',
      chunkText: r.text.slice(0, 200),
      pageNumber: r.pageNumber,
    }))

    const contextParts = results.map(
      (r, i) =>
        `[Source ${i + 1}: ${sourceTitleMap?.[r.sourceId] ?? 'Source'}${r.pageNumber ? ` p.${r.pageNumber}` : ''}]\n${r.text}`
    )
    const context = contextParts.join('\n\n')

    return { context, citations }
  }
}

export const ragService = new RagService()
