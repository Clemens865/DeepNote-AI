export interface ChunkResult {
  text: string
  index: number
  tokenCount: number
  pageNumber?: number
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Split text into sentences, keeping the delimiter attached
function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/)
  return parts.filter((s) => s.length > 0)
}

export class ChunkerService {
  chunk(
    text: string,
    options?: { chunkSize?: number; overlap?: number; pageBreaks?: number[] }
  ): ChunkResult[] {
    const targetChars = (options?.chunkSize ?? 500) * 4 // ~500 tokens = ~2000 chars
    const overlapChars = (options?.overlap ?? 100) * 4 // ~100 tokens = ~400 chars

    const sentences = splitSentences(text)
    if (sentences.length === 0) return []

    const results: ChunkResult[] = []
    let currentChunk: string[] = []
    let currentLen = 0
    let chunkIndex = 0

    for (const sentence of sentences) {
      currentChunk.push(sentence)
      currentLen += sentence.length

      if (currentLen >= targetChars) {
        const chunkText = currentChunk.join(' ').trim()
        if (chunkText.length > 0) {
          results.push({
            text: chunkText,
            index: chunkIndex++,
            tokenCount: estimateTokens(chunkText),
          })
        }

        // Calculate overlap: keep last sentences up to overlapChars
        const overlapSentences: string[] = []
        let overlapLen = 0
        for (let i = currentChunk.length - 1; i >= 0; i--) {
          overlapLen += currentChunk[i].length
          if (overlapLen > overlapChars) break
          overlapSentences.unshift(currentChunk[i])
        }
        currentChunk = overlapSentences
        currentLen = overlapSentences.reduce((sum, s) => sum + s.length, 0)
      }
    }

    // Flush remaining
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ').trim()
      if (chunkText.length > 0) {
        results.push({
          text: chunkText,
          index: chunkIndex,
          tokenCount: estimateTokens(chunkText),
        })
      }
    }

    return results
  }
}

export const chunkerService = new ChunkerService()
