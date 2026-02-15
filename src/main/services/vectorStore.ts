import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync, readdirSync, rmSync } from 'fs'

let vectorDbPath: string | null = null

interface StoredChunk {
  id: string
  sourceId: string
  text: string
  vector: number[]
  chunkIndex: number
  pageNumber?: number
}

interface VectorFile {
  chunks: StoredChunk[]
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export class VectorStoreService {
  init() {
    const userDataPath = app.getPath('userData')
    vectorDbPath = join(userDataPath, 'vector-store')
    if (!existsSync(vectorDbPath)) {
      mkdirSync(vectorDbPath, { recursive: true })
    }
    console.log('[VectorStore] Initialized at:', vectorDbPath)
  }

  private getNotebookDir(notebookId: string): string {
    const dir = join(vectorDbPath!, notebookId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
  }

  private getSourcePath(notebookId: string, sourceId: string): string {
    return join(this.getNotebookDir(notebookId), `${sourceId}.json`)
  }

  async addDocuments(
    notebookId: string,
    sourceId: string,
    chunks: { text: string; id: string; chunkIndex: number; pageNumber?: number }[],
    vectors: number[][]
  ): Promise<void> {
    const storedChunks: StoredChunk[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      sourceId,
      text: chunk.text,
      vector: vectors[i],
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
    }))

    const data: VectorFile = { chunks: storedChunks }
    const filePath = this.getSourcePath(notebookId, sourceId)
    writeFileSync(filePath, JSON.stringify(data), 'utf-8')
  }

  async search(
    notebookId: string,
    queryVector: number[],
    limit: number = 5,
    filterSourceIds?: string[]
  ): Promise<{ id: string; sourceId: string; text: string; score: number; chunkIndex: number; pageNumber?: number }[]> {
    const notebookDir = join(vectorDbPath!, notebookId)
    if (!existsSync(notebookDir)) return []

    const files = readdirSync(notebookDir).filter((f) => f.endsWith('.json'))
    const results: { id: string; sourceId: string; text: string; score: number; chunkIndex: number; pageNumber?: number }[] = []

    for (const file of files) {
      const sourceId = file.replace('.json', '')
      if (filterSourceIds && !filterSourceIds.includes(sourceId)) continue

      try {
        const raw = readFileSync(join(notebookDir, file), 'utf-8')
        const data: VectorFile = JSON.parse(raw)
        for (const chunk of data.chunks) {
          const score = cosineSimilarity(queryVector, chunk.vector)
          results.push({
            id: chunk.id,
            sourceId: chunk.sourceId,
            text: chunk.text,
            score,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
          })
        }
      } catch {
        // Skip corrupted files
      }
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  async deleteSource(notebookId: string, sourceId: string): Promise<void> {
    const filePath = this.getSourcePath(notebookId, sourceId)
    if (existsSync(filePath)) unlinkSync(filePath)
  }

  async deleteNotebook(notebookId: string): Promise<void> {
    const dir = join(vectorDbPath!, notebookId)
    if (existsSync(dir)) rmSync(dir, { recursive: true })
  }

  close() {
    vectorDbPath = null
  }
}

export const vectorStoreService = new VectorStoreService()
