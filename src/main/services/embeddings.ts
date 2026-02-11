import { GoogleGenAI } from '@google/genai'
import { configService } from './config'

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  const apiKey = configService.getApiKey()
  if (!apiKey) throw new Error('Gemini API key not configured. Please set it in Settings.')
  if (!client) {
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

// Reset client when API key changes
export function resetEmbeddingsClient(): void {
  client = null
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error && (err.message.includes('429') || err.message.includes('RATE'))
      if (!isRateLimit || attempt === maxRetries - 1) throw err
      const delay = Math.pow(2, attempt) * 1000
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

export class EmbeddingsService {
  async embed(texts: string[]): Promise<number[][]> {
    const ai = getClient()
    const results: number[][] = []
    const batchSize = 100

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const response = await withRetry(() =>
        ai.models.embedContent({
          model: 'text-embedding-004',
          contents: batch.map((text) => ({ parts: [{ text }] })),
        })
      )
      if (response.embeddings) {
        for (const emb of response.embeddings) {
          results.push(emb.values ?? [])
        }
      }
    }

    return results
  }

  async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embed([text])
    return vectors[0] ?? new Array(768).fill(0)
  }
}

export const embeddingsService = new EmbeddingsService()
