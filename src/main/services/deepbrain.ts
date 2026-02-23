/**
 * DeepBrain Bridge Service
 *
 * HTTP client wrapping DeepBrain's REST API (localhost:19519).
 * Provides system-wide memory, file search, clipboard history,
 * and cognitive operations to DeepNote AI.
 *
 * All methods gracefully return null/empty when DeepBrain is offline.
 */

import { configService } from './config'

// --- Types ---

export interface DeepBrainStatus {
  available: boolean
  memoryCount: number
  thoughtCount: number
  aiProvider: string
  aiAvailable: boolean
  embeddingProvider: string
  learningTrend: string
  indexedFiles: number
  indexedChunks: number
  uptimeMs: number
}

export interface ThinkResponse {
  response: string
  confidence: number
  thoughtId: string
  memoryCount: number
  aiEnhanced: boolean
}

export interface RememberResponse {
  id: string
  memoryCount: number
}

export interface RecallItem {
  id: string
  content: string
  similarity: number
  memoryType: string
}

export interface FileSearchResult {
  path: string
  name: string
  chunk: string
  similarity: number
  fileType: string
  project?: string
  modified?: string
}

export interface ActivityCurrent {
  activeApp: string
  windowTitle: string
  project?: string
  idleSeconds: number
  recentFiles: { path: string; timestamp: number }[]
  recentClipboard?: string
}

export interface ActivityEvent {
  id: string
  timestamp: number
  eventType: string
  appName: string
  windowTitle: string
  filePath?: string
  project?: string
}

export interface ClipboardEntry {
  content: string
  timestamp: number
}

export type MemoryType =
  | 'semantic'
  | 'episodic'
  | 'working'
  | 'procedural'
  | 'meta'
  | 'causal'
  | 'goal'
  | 'emotional'

// --- Service ---

class DeepBrainService {
  private baseUrl = 'http://127.0.0.1:19519'
  private apiToken: string | null = null
  private availableCache: { value: boolean; timestamp: number } | null = null
  private readonly CACHE_TTL = 10_000 // 10 seconds
  private readonly TIMEOUT = 2_000 // 2 second timeout

  constructor() {
    // Load config on first use
    try {
      const config = configService.getAll()
      if (config.deepbrainPort) this.baseUrl = `http://127.0.0.1:${config.deepbrainPort}`
      if (config.deepbrainToken) this.apiToken = config.deepbrainToken
    } catch {
      // Config not ready yet, use defaults
    }
  }

  setPort(port: number): void {
    this.baseUrl = `http://127.0.0.1:${port}`
    this.availableCache = null
  }

  setApiToken(token: string | null): void {
    this.apiToken = token
  }

  // --- HTTP helpers ---

  private async fetch<T>(path: string, options?: RequestInit): Promise<T | null> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.TIMEOUT)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`
      }

      const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: { ...headers, ...options?.headers },
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!res.ok) {
        console.warn(`[DeepBrain] ${path} returned ${res.status}`)
        return null
      }

      return (await res.json()) as T
    } catch (err) {
      // Silent fail — DeepBrain may not be running
      if ((err as Error).name !== 'AbortError') {
        // Only log non-timeout errors occasionally
      }
      return null
    }
  }

  // --- Connection ---

  async isAvailable(): Promise<boolean> {
    // Check cache
    if (
      this.availableCache &&
      Date.now() - this.availableCache.timestamp < this.CACHE_TTL
    ) {
      return this.availableCache.value
    }

    const result = await this.fetch<{ ok: boolean }>('/api/health')
    const available = result?.ok === true
    this.availableCache = { value: available, timestamp: Date.now() }
    return available
  }

  async getStatus(): Promise<DeepBrainStatus | null> {
    const available = await this.isAvailable()
    if (!available) {
      return {
        available: false,
        memoryCount: 0,
        thoughtCount: 0,
        aiProvider: 'none',
        aiAvailable: false,
        embeddingProvider: 'none',
        learningTrend: 'unknown',
        indexedFiles: 0,
        indexedChunks: 0,
        uptimeMs: 0,
      }
    }

    const raw = await this.fetch<Record<string, unknown>>('/api/status')
    if (!raw) return null

    return {
      available: true,
      memoryCount: (raw.memory_count as number) || 0,
      thoughtCount: (raw.thought_count as number) || 0,
      aiProvider: (raw.ai_provider as string) || 'none',
      aiAvailable: (raw.ai_available as boolean) || false,
      embeddingProvider: (raw.embedding_provider as string) || 'none',
      learningTrend: (raw.learning_trend as string) || 'unknown',
      indexedFiles: (raw.indexed_files as number) || 0,
      indexedChunks: (raw.indexed_chunks as number) || 0,
      uptimeMs: (raw.uptime_ms as number) || 0,
    }
  }

  // --- Cognitive Operations ---

  async think(input: string): Promise<ThinkResponse | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/think', {
      method: 'POST',
      body: JSON.stringify({ input }),
    })
    if (!raw) return null

    return {
      response: (raw.response as string) || '',
      confidence: (raw.confidence as number) || 0,
      thoughtId: (raw.thought_id as string) || '',
      memoryCount: (raw.memory_count as number) || 0,
      aiEnhanced: (raw.ai_enhanced as boolean) || false,
    }
  }

  async remember(
    content: string,
    memoryType: MemoryType = 'semantic',
    importance = 0.5
  ): Promise<RememberResponse | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/remember', {
      method: 'POST',
      body: JSON.stringify({
        content,
        memory_type: memoryType,
        importance,
      }),
    })
    if (!raw) return null

    return {
      id: (raw.id as string) || '',
      memoryCount: (raw.memory_count as number) || 0,
    }
  }

  async recall(query: string, limit = 5): Promise<RecallItem[]> {
    if (!(await this.isAvailable())) return []

    const raw = await this.fetch<Array<Record<string, unknown>>>('/api/recall', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    })
    if (!raw || !Array.isArray(raw)) return []

    return raw.map((r) => ({
      id: (r.id as string) || '',
      content: (r.content as string) || '',
      similarity: (r.similarity as number) || 0,
      memoryType: (r.memory_type as string) || 'semantic',
    }))
  }

  // --- File Search ---

  async searchFiles(query: string, limit = 10): Promise<FileSearchResult[]> {
    if (!(await this.isAvailable())) return []

    const raw = await this.fetch<Array<Record<string, unknown>>>('/api/search/files', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    })
    if (!raw || !Array.isArray(raw)) return []

    return raw.map((r) => ({
      path: (r.path as string) || '',
      name: (r.name as string) || '',
      chunk: (r.chunk as string) || '',
      similarity: (r.similarity as number) || 0,
      fileType: (r.file_type as string) || '',
      project: (r.project as string) || undefined,
      modified: (r.modified as string) || undefined,
    }))
  }

  // --- Email Search ---

  async searchEmails(
    query: string,
    limit = 5
  ): Promise<{ subject: string; sender: string; date: string; chunk: string; similarity: number }[]> {
    if (!(await this.isAvailable())) return []

    const raw = await this.fetch<Array<Record<string, unknown>>>('/api/search/emails', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    })
    if (!raw || !Array.isArray(raw)) return []

    return raw.map((r) => ({
      subject: (r.subject as string) || '',
      sender: (r.sender as string) || '',
      date: (r.date as string) || '',
      chunk: (r.chunk as string) || '',
      similarity: (r.similarity as number) || 0,
    }))
  }

  // --- Activity Observer ---

  async getActivityCurrent(): Promise<ActivityCurrent | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/activity/current')
    if (!raw) return null

    const recentFiles = Array.isArray(raw.recent_files)
      ? (raw.recent_files as { path: string; timestamp: number }[])
      : []

    return {
      activeApp: (raw.active_app as string) || '',
      windowTitle: (raw.window_title as string) || '',
      project: (raw.project as string) || undefined,
      idleSeconds: (raw.idle_seconds as number) || 0,
      recentFiles,
      recentClipboard: (raw.recent_clipboard as string) || undefined,
    }
  }

  /** Fetch activity history for a time range */
  async getActivityStream(
    since: string,
    opts?: { until?: string; types?: string[]; project?: string; limit?: number }
  ): Promise<ActivityEvent[]> {
    if (!(await this.isAvailable())) return []

    const raw = await this.fetch<Array<Record<string, unknown>>>('/api/activity/stream', {
      method: 'POST',
      body: JSON.stringify({
        since,
        until: opts?.until,
        types: opts?.types,
        project: opts?.project,
        limit: opts?.limit || 50,
      }),
    })
    if (!raw || !Array.isArray(raw)) return []

    return raw.map((r) => ({
      id: (r.id as string) || '',
      timestamp: (r.timestamp as number) || 0,
      eventType: (r.event_type as string) || '',
      appName: (r.app_name as string) || '',
      windowTitle: (r.window_title as string) || '',
      filePath: (r.file_path as string) || undefined,
      project: (r.project as string) || undefined,
    }))
  }

  // --- Clipboard ---

  async getClipboardHistory(limit = 10): Promise<ClipboardEntry[]> {
    if (!(await this.isAvailable())) return []

    const raw = await this.fetch<Array<Record<string, unknown>>>('/api/clipboard')
    if (!raw || !Array.isArray(raw)) return []

    return raw.slice(0, limit).map((r) => ({
      content: (r.content as string) || '',
      timestamp: (r.timestamp as number) || 0,
    }))
  }
}

export const deepbrainService = new DeepBrainService()
