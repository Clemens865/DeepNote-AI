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

  chunkTabular(text: string, options?: { rowsPerChunk?: number }): ChunkResult[] {
    const rowsPerChunk = options?.rowsPerChunk ?? 50
    const sections = text.split(/^## Sheet: .+$/m).filter((s) => s.trim())
    const sheetHeaders = [...text.matchAll(/^## Sheet: (.+)$/gm)].map((m) => m[1])

    const results: ChunkResult[] = []
    let chunkIndex = 0

    for (let si = 0; si < sections.length; si++) {
      const lines = sections[si].trim().split('\n')
      const headerIdx = lines.findIndex((l) => l.startsWith('|'))
      if (headerIdx === -1 || headerIdx + 1 >= lines.length) {
        const regularChunks = this.chunk(sections[si])
        for (const c of regularChunks) {
          results.push({ ...c, index: chunkIndex++ })
        }
        continue
      }

      const headerLine = lines[headerIdx]
      const separatorLine = lines[headerIdx + 1]
      const dataRows = lines.slice(headerIdx + 2).filter((l) => l.startsWith('|'))
      const sheetLabel = sheetHeaders[si] ? `Sheet: ${sheetHeaders[si]}\n` : ''

      for (let i = 0; i < dataRows.length; i += rowsPerChunk) {
        const batch = dataRows.slice(i, i + rowsPerChunk)
        const chunkText = `${sheetLabel}${headerLine}\n${separatorLine}\n${batch.join('\n')}`
        results.push({
          text: chunkText,
          index: chunkIndex++,
          tokenCount: Math.ceil(chunkText.length / 4),
        })
      }
    }

    return results.length > 0 ? results : this.chunk(text)
  }
}

export const chunkerService = new ChunkerService()
