/**
 * DeepNote REST API Server
 *
 * Exposes DeepNote's knowledge (notebooks, sources, chat, content)
 * as a local REST API on localhost:19520. This enables bidirectional
 * integration with DeepBrain, shell scripts, Raycast, Alfred, and
 * any other local tool.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import type { Server } from 'http'
import { getDatabase, schema } from '../db'
import { ragService } from './rag'
import { configService } from './config'

class DeepNoteApiServer {
  private server: Server | null = null
  private port = 19520

  constructor() {
    try {
      const config = configService.getAll()
      if (config.deepnoteApiPort) this.port = config.deepnoteApiPort
    } catch {
      // Config not ready yet
    }
  }

  setPort(port: number): void {
    this.port = port
  }

  start(): void {
    if (this.server) return

    this.server = createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        console.error('[DeepNote API] Request error:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal server error' }))
      })
    })

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[DeepNote API] Listening on http://127.0.0.1:${this.port}`)
    })

    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[DeepNote API] Port ${this.port} in use, trying ${this.port + 1}`)
        this.port++
        this.server?.listen(this.port, '127.0.0.1')
      } else {
        console.error('[DeepNote API] Server error:', err)
      }
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
      console.log('[DeepNote API] Server stopped')
    }
  }

  getPort(): number {
    return this.port
  }

  // --- Request Handling ---

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Optional auth
    const apiToken = this.getApiToken()
    if (apiToken && req.headers.authorization !== `Bearer ${apiToken}`) {
      // Allow health check without auth
      if (req.url !== '/api/health') {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`)
    const path = url.pathname

    try {
      // Route matching
      if (path === '/api/health' && req.method === 'GET') {
        return this.handleHealth(res)
      }
      if (path === '/api/stats' && req.method === 'GET') {
        return this.handleStats(res)
      }
      if (path === '/api/notebooks' && req.method === 'GET') {
        return this.handleListNotebooks(res)
      }
      if (path === '/api/search' && req.method === 'POST') {
        return await this.handleSearch(req, res)
      }
      if (path === '/api/remember' && req.method === 'POST') {
        return await this.handleRemember(req, res)
      }

      // Parameterized routes: /api/notebooks/:id/...
      const notebookMatch = path.match(/^\/api\/notebooks\/([^/]+)\/(.+)$/)
      if (notebookMatch) {
        const notebookId = decodeURIComponent(notebookMatch[1])
        const sub = notebookMatch[2]

        if (sub === 'sources' && req.method === 'GET') {
          return this.handleListSources(res, notebookId)
        }
        if (sub === 'chat' && req.method === 'GET') {
          const limit = parseInt(url.searchParams.get('limit') || '20')
          return this.handleListChat(res, notebookId, limit)
        }
        if (sub === 'content' && req.method === 'GET') {
          return this.handleListContent(res, notebookId)
        }
        if (sub === 'notes' && req.method === 'GET') {
          return this.handleListNotes(res, notebookId)
        }

        // /api/notebooks/:id/sources/:sourceId/content
        const sourceMatch = sub.match(/^sources\/([^/]+)\/content$/)
        if (sourceMatch && req.method === 'GET') {
          const sourceId = decodeURIComponent(sourceMatch[1])
          return this.handleGetSourceContent(res, sourceId)
        }

        // /api/notebooks/:id/content/:contentId
        const contentMatch = sub.match(/^content\/([^/]+)$/)
        if (contentMatch && req.method === 'GET') {
          const contentId = decodeURIComponent(contentMatch[1])
          return this.handleGetContent(res, contentId)
        }
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    } catch (err) {
      console.error('[DeepNote API] Handler error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  }

  private getApiToken(): string | null {
    try {
      const config = configService.getAll()
      return config.deepnoteApiToken || null
    } catch {
      return null
    }
  }

  private sendJson(res: ServerResponse, data: unknown, status = 200): void {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  private async parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          resolve({})
        }
      })
    })
  }

  // --- Handlers ---

  private handleHealth(res: ServerResponse): void {
    const db = getDatabase()
    const notebooks = db.select().from(schema.notebooks).all()
    this.sendJson(res, {
      ok: true,
      notebooks: notebooks.length,
      version: '1.0.0',
      service: 'DeepNote AI',
    })
  }

  private handleStats(res: ServerResponse): void {
    const db = getDatabase()
    const notebooks = db.select().from(schema.notebooks).all()
    const sources = db.select().from(schema.sources).all()
    const messages = db.select().from(schema.chatMessages).all()
    const content = db.select().from(schema.generatedContent).all()
    const notes = db.select().from(schema.notes).all()

    this.sendJson(res, {
      totalNotebooks: notebooks.length,
      totalSources: sources.length,
      totalMessages: messages.length,
      totalGenerated: content.length,
      totalNotes: notes.length,
    })
  }

  private handleListNotebooks(res: ServerResponse): void {
    const db = getDatabase()
    const notebooks = db.select().from(schema.notebooks).all()
    const sources = db.select().from(schema.sources).all()

    const result = notebooks.map((n) => ({
      id: n.id,
      title: n.title,
      emoji: n.emoji,
      description: n.description,
      sourceCount: sources.filter((s) => s.notebookId === n.id).length,
      createdAt: n.createdAt,
    }))

    this.sendJson(res, result)
  }

  private handleListSources(res: ServerResponse, notebookId: string): void {
    const db = getDatabase()
    const sources = db
      .select()
      .from(schema.sources)
      .all()
      .filter((s) => s.notebookId === notebookId)

    const result = sources.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      contentPreview: (s.content || '').slice(0, 500),
      isSelected: s.isSelected,
    }))

    this.sendJson(res, result)
  }

  private handleGetSourceContent(res: ServerResponse, sourceId: string): void {
    const db = getDatabase()
    const source = db
      .select()
      .from(schema.sources)
      .all()
      .find((s) => s.id === sourceId)

    if (!source) {
      this.sendJson(res, { error: 'Source not found' }, 404)
      return
    }

    this.sendJson(res, {
      id: source.id,
      title: source.title,
      type: source.type,
      content: source.content,
    })
  }

  private handleListChat(res: ServerResponse, notebookId: string, limit: number): void {
    const db = getDatabase()
    const messages = db
      .select()
      .from(schema.chatMessages)
      .all()
      .filter((m) => m.notebookId === notebookId)
      .slice(-limit)

    const result = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      citations: typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations,
      createdAt: m.createdAt,
    }))

    this.sendJson(res, result)
  }

  private handleListContent(res: ServerResponse, notebookId: string): void {
    const db = getDatabase()
    const content = db
      .select()
      .from(schema.generatedContent)
      .all()
      .filter((c) => c.notebookId === notebookId)

    const result = content.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
    }))

    this.sendJson(res, result)
  }

  private handleGetContent(res: ServerResponse, contentId: string): void {
    const db = getDatabase()
    const content = db
      .select()
      .from(schema.generatedContent)
      .all()
      .find((c) => c.id === contentId)

    if (!content) {
      this.sendJson(res, { error: 'Content not found' }, 404)
      return
    }

    this.sendJson(res, {
      id: content.id,
      type: content.type,
      title: content.title,
      data: typeof content.data === 'string' ? JSON.parse(content.data) : content.data,
      createdAt: content.createdAt,
    })
  }

  private handleListNotes(res: ServerResponse, notebookId: string): void {
    const db = getDatabase()
    const notes = db
      .select()
      .from(schema.notes)
      .all()
      .filter((n) => n.notebookId === notebookId)

    const result = notes.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      createdAt: n.createdAt,
    }))

    this.sendJson(res, result)
  }

  private async handleSearch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.parseBody(req)
    const query = body.query as string
    const notebookId = body.notebookId as string | undefined
    const limit = (body.limit as number) || 10

    if (!query) {
      this.sendJson(res, { error: 'query is required' }, 400)
      return
    }

    const db = getDatabase()
    const notebooks = db.select().from(schema.notebooks).all()
    const sources = db.select().from(schema.sources).all()

    // Determine which notebooks to search
    const targetNotebooks = notebookId
      ? notebooks.filter((n) => n.id === notebookId)
      : notebooks

    const allResults: Array<{
      notebookId: string
      notebookTitle: string
      sourceTitle: string
      chunk: string
      similarity: number
    }> = []

    for (const nb of targetNotebooks) {
      const nbSources = sources.filter((s) => s.notebookId === nb.id && s.isSelected)
      const sourceIds = nbSources.map((s) => s.id)
      const sourceTitleMap: Record<string, string> = {}
      for (const s of nbSources) sourceTitleMap[s.id] = s.title

      if (sourceIds.length === 0) continue

      try {
        const ragResult = await ragService.query(nb.id, query, sourceIds, sourceTitleMap)
        for (const citation of ragResult.citations) {
          allResults.push({
            notebookId: nb.id,
            notebookTitle: nb.title,
            sourceTitle: citation.sourceTitle,
            chunk: citation.chunkText,
            similarity: 1.0, // RAG doesn't expose scores directly
          })
        }
      } catch {
        // Skip notebooks with RAG errors
      }
    }

    this.sendJson(res, { results: allResults.slice(0, limit) })
  }

  private async handleRemember(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.parseBody(req)
    const notebookId = body.notebookId as string
    const content = body.content as string
    const role = ((body.role as string) || 'assistant') as 'user' | 'assistant'

    if (!notebookId || !content) {
      this.sendJson(res, { error: 'notebookId and content are required' }, 400)
      return
    }

    const db = getDatabase()
    const { randomUUID } = await import('crypto')
    const msg = {
      id: randomUUID(),
      notebookId,
      role,
      content,
      citations: JSON.stringify([]),
      createdAt: new Date().toISOString(),
    }
    db.insert(schema.chatMessages).values(msg).run()

    this.sendJson(res, { ...msg, citations: [] })
  }
}

export const deepnoteApiServer = new DeepNoteApiServer()
