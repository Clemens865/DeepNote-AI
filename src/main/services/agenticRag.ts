import { GoogleGenAI } from '@google/genai'
import { configService } from './config'
import { embeddingsService } from './embeddings'
import { vectorStoreService } from './vectorStore'
import type { Citation } from '../../shared/types'

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  const apiKey = configService.getApiKey()
  if (!apiKey) throw new Error('Gemini API key not configured.')
  if (!client) client = new GoogleGenAI({ apiKey })
  return client
}

export function resetAgenticRagClient(): void {
  client = null
}

interface RagResult {
  context: string
  citations: Citation[]
}

/**
 * Generate 2-3 targeted search sub-queries from the user's question.
 */
async function generateSubQueries(question: string): Promise<string[]> {
  const ai = getClient()

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are a search query optimizer. Given the user's question, generate 2-3 targeted search queries that would help find the most relevant information in a document collection. Each query should approach the topic from a different angle.

User question: "${question}"

Output a JSON array of strings, each being a search query. Output ONLY the JSON array, no markdown fences.
Example: ["query 1", "query 2", "query 3"]`,
          },
        ],
      },
    ],
  })

  const raw = (response.text ?? '[]').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    const queries = JSON.parse(raw)
    if (Array.isArray(queries) && queries.length > 0) {
      return queries.slice(0, 3).map(String)
    }
  } catch {
    // Fallback to original question
  }
  return [question]
}

/**
 * Embed and search for each sub-query, then merge results.
 */
async function multiQuerySearch(
  notebookId: string,
  queries: string[],
  filterSourceIds?: string[]
): Promise<{ id: string; sourceId: string; text: string; score: number; chunkIndex: number; pageNumber?: number }[]> {
  const allResults = new Map<
    string,
    { id: string; sourceId: string; text: string; score: number; chunkIndex: number; pageNumber?: number }
  >()

  for (const query of queries) {
    const queryVector = await embeddingsService.embedQuery(query)
    const results = await vectorStoreService.search(notebookId, queryVector, 6, filterSourceIds)

    for (const r of results) {
      const existing = allResults.get(r.id)
      if (existing) {
        // Combine scores — take max
        existing.score = Math.max(existing.score, r.score)
      } else {
        allResults.set(r.id, { ...r })
      }
    }
  }

  const merged = Array.from(allResults.values())
  merged.sort((a, b) => b.score - a.score)
  return merged
}

/**
 * Ask the AI if the retrieved context is sufficient for answering the question.
 */
async function shouldRetrieveMore(question: string, currentContext: string): Promise<boolean> {
  if (!currentContext || currentContext.length < 200) return true

  const ai = getClient()
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Given this question and the retrieved context, is the context sufficient to answer the question well? Answer with ONLY "yes" or "no".

Question: "${question}"

Retrieved context (first 2000 chars):
${currentContext.slice(0, 2000)}`,
          },
        ],
      },
    ],
  })

  const answer = (response.text ?? '').trim().toLowerCase()
  return answer.startsWith('no')
}

/**
 * Main agentic RAG entry point.
 * Uses multi-query retrieval + optional refinement iteration.
 */
export async function agenticQuery(
  notebookId: string,
  question: string,
  selectedSourceIds?: string[],
  sourceTitleMap?: Record<string, string>
): Promise<RagResult> {
  // Step 1: Generate sub-queries
  let subQueries: string[]
  try {
    subQueries = await generateSubQueries(question)
  } catch (err) {
    console.warn('[AgenticRAG] Sub-query generation failed, using original:', err)
    subQueries = [question]
  }

  console.log('[AgenticRAG] Sub-queries:', subQueries)

  // Step 2: Multi-query search
  let results = await multiQuerySearch(notebookId, subQueries, selectedSourceIds)

  // Step 3: Build initial context
  let contextParts = results.slice(0, 8).map(
    (r, i) =>
      `[Source ${i + 1}: ${sourceTitleMap?.[r.sourceId] ?? 'Source'}${r.pageNumber ? ` p.${r.pageNumber}` : ''}]\n${r.text}`
  )
  let context = contextParts.join('\n\n')

  // Step 4: Check if more context is needed (1 iteration max)
  try {
    const needsMore = await shouldRetrieveMore(question, context)
    if (needsMore && results.length > 8) {
      // Include more results
      contextParts = results.slice(0, 12).map(
        (r, i) =>
          `[Source ${i + 1}: ${sourceTitleMap?.[r.sourceId] ?? 'Source'}${r.pageNumber ? ` p.${r.pageNumber}` : ''}]\n${r.text}`
      )
      context = contextParts.join('\n\n')
    }
  } catch {
    // Non-critical — use what we have
  }

  const citations = results.slice(0, 8).map((r) => ({
    sourceId: r.sourceId,
    sourceTitle: sourceTitleMap?.[r.sourceId] ?? 'Source',
    chunkText: r.text.slice(0, 200),
    pageNumber: r.pageNumber,
  }))

  return { context, citations }
}
