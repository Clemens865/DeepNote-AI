/**
 * Knowledge Store — core CRUD + vector search for the knowledge table.
 */

import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { eq, desc, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../db'
import { embed, embedQuery } from './tieredEmbeddings'

export type KnowledgeType = 'document' | 'note' | 'manual' | 'clipboard' | 'chat'

export interface KnowledgeRecord {
  id: string
  content: string
  type: KnowledgeType
  importance: number
  sourcePath: string | null
  sourceTitle: string | null
  contentHash: string
  tags: string[]
  clusterId: string | null
  createdAt: number
  updatedAt: number
}

export interface KnowledgeSearchResult extends KnowledgeRecord {
  similarity: number
}

export interface KnowledgeStats {
  total: number
  byType: Record<string, number>
  folderCount: number
}

export interface KnowledgeGraphNode {
  id: string
  label: string
  type: KnowledgeType
  importance: number
  content?: string
}

export interface KnowledgeGraphEdge {
  source: string
  target: string
  weight: number
}

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

function bufferToFloatArray(buf: Buffer): number[] {
  const floats = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
  return Array.from(floats)
}

function floatArrayToBuffer(arr: number[]): Buffer {
  const f32 = new Float32Array(arr)
  return Buffer.from(f32.buffer)
}

class KnowledgeStoreService {
  /**
   * Add knowledge record. Skips if content hash already exists (dedup).
   */
  async add(
    content: string,
    opts: {
      type?: KnowledgeType
      importance?: number
      sourcePath?: string
      sourceTitle?: string
      tags?: string[]
    } = {}
  ): Promise<KnowledgeRecord | null> {
    const db = getDatabase()
    const hash = contentHash(content)

    // Dedup check
    const existing = db
      .select({ id: schema.knowledge.id })
      .from(schema.knowledge)
      .where(eq(schema.knowledge.contentHash, hash))
      .get()
    if (existing) return null

    // Generate embedding
    let embeddingBuf: Buffer | null = null
    let dim = 768
    try {
      const [vec] = await embed([content])
      if (vec) {
        embeddingBuf = floatArrayToBuffer(vec)
        dim = vec.length
      }
    } catch (err) {
      console.warn('[KnowledgeStore] Embedding failed:', err)
    }

    const now = Date.now()
    const record = {
      id: randomUUID(),
      content,
      embedding: embeddingBuf,
      embeddingDim: dim,
      type: opts.type || 'document',
      importance: opts.importance ?? 0.5,
      sourcePath: opts.sourcePath || null,
      sourceTitle: opts.sourceTitle || null,
      contentHash: hash,
      tags: JSON.stringify(opts.tags || []),
      clusterId: null,
      createdAt: now,
      updatedAt: now,
    }

    db.insert(schema.knowledge).values(record).run()

    return {
      id: record.id,
      content: record.content,
      type: record.type as KnowledgeType,
      importance: record.importance,
      sourcePath: record.sourcePath,
      sourceTitle: record.sourceTitle,
      contentHash: record.contentHash,
      tags: opts.tags || [],
      clusterId: null,
      createdAt: now,
      updatedAt: now,
    }
  }

  /**
   * Semantic similarity search.
   */
  async search(query: string, limit = 10): Promise<KnowledgeSearchResult[]> {
    const db = getDatabase()

    // Embed query
    let queryVec: number[]
    try {
      queryVec = await embedQuery(query)
    } catch {
      return []
    }

    // Load all records with embeddings
    const rows = db
      .select()
      .from(schema.knowledge)
      .all()

    const scored: KnowledgeSearchResult[] = []
    for (const row of rows) {
      if (!row.embedding) continue
      const vec = bufferToFloatArray(row.embedding as Buffer)
      // Handle dimension mismatch by skipping
      if (vec.length !== queryVec.length) continue
      const sim = cosineSimilarity(queryVec, vec)
      if (sim > 0.1) {
        scored.push({
          id: row.id,
          content: row.content,
          type: row.type as KnowledgeType,
          importance: row.importance,
          sourcePath: row.sourcePath,
          sourceTitle: row.sourceTitle,
          contentHash: row.contentHash,
          tags: JSON.parse(row.tags as string || '[]'),
          clusterId: row.clusterId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          similarity: sim,
        })
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity)
    return scored.slice(0, limit)
  }

  /**
   * List knowledge records with pagination and optional type filter.
   */
  list(opts: { type?: KnowledgeType; offset?: number; limit?: number } = {}): {
    items: KnowledgeRecord[]
    total: number
  } {
    const db = getDatabase()
    const offset = opts.offset ?? 0
    const limit = opts.limit ?? 30

    let totalQuery
    let itemsQuery

    if (opts.type) {
      totalQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.knowledge)
        .where(eq(schema.knowledge.type, opts.type))
        .get()

      itemsQuery = db
        .select()
        .from(schema.knowledge)
        .where(eq(schema.knowledge.type, opts.type))
        .orderBy(desc(schema.knowledge.createdAt))
        .limit(limit)
        .offset(offset)
        .all()
    } else {
      totalQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.knowledge)
        .get()

      itemsQuery = db
        .select()
        .from(schema.knowledge)
        .orderBy(desc(schema.knowledge.createdAt))
        .limit(limit)
        .offset(offset)
        .all()
    }

    const total = totalQuery?.count ?? 0
    const items: KnowledgeRecord[] = itemsQuery.map((row) => ({
      id: row.id,
      content: row.content,
      type: row.type as KnowledgeType,
      importance: row.importance,
      sourcePath: row.sourcePath,
      sourceTitle: row.sourceTitle,
      contentHash: row.contentHash,
      tags: JSON.parse(row.tags as string || '[]'),
      clusterId: row.clusterId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))

    return { items, total }
  }

  /**
   * Delete a knowledge record.
   */
  delete(id: string): boolean {
    const db = getDatabase()
    const result = db
      .delete(schema.knowledge)
      .where(eq(schema.knowledge.id, id))
      .run()
    return result.changes > 0
  }

  /**
   * Get knowledge store stats.
   */
  getStats(): KnowledgeStats {
    const db = getDatabase()

    const total = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.knowledge)
      .get()?.count ?? 0

    const byTypeRows = db
      .select({
        type: schema.knowledge.type,
        count: sql<number>`count(*)`,
      })
      .from(schema.knowledge)
      .groupBy(schema.knowledge.type)
      .all()

    const byType: Record<string, number> = {}
    for (const row of byTypeRows) {
      byType[row.type] = row.count
    }

    const folderCount = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.knowledgeFolders)
      .get()?.count ?? 0

    return {
      total,
      byType,
      folderCount,
    }
  }

  /**
   * Build a knowledge graph from embedding proximity.
   */
  async getGraph(seedId?: string, hops = 2): Promise<{
    nodes: KnowledgeGraphNode[]
    edges: KnowledgeGraphEdge[]
  }> {
    const db = getDatabase()

    // Load all records with embeddings
    const allRows = db
      .select()
      .from(schema.knowledge)
      .all()

    const rowsWithEmbeddings = allRows.filter((r) => r.embedding)
    if (rowsWithEmbeddings.length === 0) return { nodes: [], edges: [] }

    // If no seed, use first record
    const seed = seedId
      ? rowsWithEmbeddings.find((r) => r.id === seedId) || rowsWithEmbeddings[0]
      : rowsWithEmbeddings[0]

    const visited = new Set<string>()
    const nodeMap = new Map<string, KnowledgeGraphNode>()
    const edgeList: KnowledgeGraphEdge[] = []

    // BFS with hop limit
    const queue: { id: string; depth: number }[] = [{ id: seed.id, depth: 0 }]
    const vecCache = new Map<string, number[]>()

    for (const row of rowsWithEmbeddings) {
      vecCache.set(row.id, bufferToFloatArray(row.embedding as Buffer))
    }

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)

      const row = rowsWithEmbeddings.find((r) => r.id === id)
      if (!row) continue

      nodeMap.set(id, {
        id: row.id,
        label: (row.sourceTitle || row.content.slice(0, 60)).replace(/\n/g, ' '),
        type: row.type as KnowledgeType,
        importance: row.importance,
        content: row.content.slice(0, 300),
      })

      if (depth >= hops) continue

      // Find top-5 neighbors by cosine similarity
      const thisVec = vecCache.get(id)
      if (!thisVec) continue

      const neighbors: { id: string; sim: number }[] = []
      for (const other of rowsWithEmbeddings) {
        if (other.id === id || visited.has(other.id)) continue
        const otherVec = vecCache.get(other.id)
        if (!otherVec || otherVec.length !== thisVec.length) continue
        const sim = cosineSimilarity(thisVec, otherVec)
        if (sim > 0.3) neighbors.push({ id: other.id, sim })
      }
      neighbors.sort((a, b) => b.sim - a.sim)

      for (const n of neighbors.slice(0, 5)) {
        edgeList.push({ source: id, target: n.id, weight: n.sim })
        queue.push({ id: n.id, depth: depth + 1 })
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges: edgeList,
    }
  }

}

export const knowledgeStoreService = new KnowledgeStoreService()
