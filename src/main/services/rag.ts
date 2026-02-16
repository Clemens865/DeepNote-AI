import { embeddingsService } from './embeddings'
import { vectorStoreService } from './vectorStore'
import { agenticQuery } from './agenticRag'
import type { Citation } from '../../shared/types'

interface RagResult {
  context: string
  citations: Citation[]
}

export interface RagOptions {
  agentic?: boolean
}

export class RagService {
  async query(
    notebookId: string,
    question: string,
    selectedSourceIds?: string[],
    sourceTitleMap?: Record<string, string>,
    options?: RagOptions
  ): Promise<RagResult> {
    // Use agentic RAG when enabled (default for chat)
    if (options?.agentic) {
      try {
        return await agenticQuery(notebookId, question, selectedSourceIds, sourceTitleMap)
      } catch (err) {
        console.warn('[RAG] Agentic query failed, falling back to standard:', err)
      }
    }

    // Standard single-query RAG
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
