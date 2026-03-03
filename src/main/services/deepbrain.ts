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
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

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

// --- Control Center Types ---

export interface ConnectorInfo {
  id: string
  name: string
  description: string
  enabled: boolean
  detected: boolean
  detectionDetails?: string
  iconHint?: string
  configurable?: boolean
  pathOverride?: string
}

export interface BootstrapResult {
  totalCreated: number
  totalSkipped: number
  totalErrors: number
  sources: { source: string; created: number; skipped: number; errors: number }[]
}

export interface GraphStats {
  nodeCount: number
  edgeCount: number
  avgDegree: number
  components: number
}

export interface GraphNode {
  id: string
  label: string
  memoryType: string
  importance: number
  content?: string
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
  edgeType?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface SonaStats {
  loopA: { active: boolean; gradientNorm: number; microLoraCount: number }
  loopB: { active: boolean; clusterCount: number; lastRun?: string }
  loopC: { active: boolean; ewcPenalty: number; lastRun?: string }
}

export interface NervousStats {
  routerSync: number
  hopfieldEnergy: number
  oscillatorPhase: number
  predictiveCodingError: number
}

export interface StorageHealth {
  hotTierSize: number
  warmTierSize: number
  coldTierSize: number
  totalSize: number
  fragmentationRatio: number
}

export interface CompressionStats {
  hotTierSize: number
  warmTierSize: number
  coldTierSize: number
  compressionRatio: number
  totalRecords: number
}

export interface LlmStatus {
  loaded: boolean
  backend: string
  modelName: string
  memoryUsageMb: number
  tokensProcessed: number
}

export interface BrainCycleResult {
  cycleNumber: number
  trainingInsights: string[]
  memoriesPruned: number
}

export interface BrainEvolveResult {
  adaptations: string[]
  improvements: string[]
  thoughtId?: string
}

export interface BrainwireConsolidationResult {
  memoriesProcessed: number
  clustersFound: number
  memoriesConsolidated: number
  newAbstractions: number
  memoriesDecayed: number
}

export interface BrainwireStatus {
  totalMemories: number
  activeMemories: number
  dormantMemories: number
  stmEntries: number
  consolidationCycles: number
  avgSalience: number
  workingMemoryItems: number
  conceptCount: number
}

export interface BrainwireWorkingMemoryItem {
  memoryId: string
  gist: string
  concepts: string[]
  activatedAt: string
  relevance: number
}

export interface KnowledgeExportResult {
  topicsWritten: number
  memoriesExported: number
  outputPath: string
}

export interface KnowledgeTopicItem {
  slug: string
  name: string
  sizeBytes: number
  modifiedTs: number
  memoryCount: number
}

export interface KnowledgeTopicsStats {
  topicsWritten: number
  memoriesExported: number
  consolidationCycles: number
  avgSalience: number
}

export interface KnowledgeTopicsResponse {
  topics: KnowledgeTopicItem[]
  stats: KnowledgeTopicsStats | null
  lastExported: number | null
}

export interface MemoryItem {
  id: string
  content: string
  memoryType: string
  importance: number
  createdAt?: string
}

export interface MemoryListResult {
  items: MemoryItem[]
  total: number
  offset: number
  limit: number
}

// --- Service ---

class DeepBrainService {
  private baseUrl = 'http://127.0.0.1:19519'
  private apiToken: string | null = null
  private availableCache: { value: boolean; timestamp: number } | null = null
  private readonly CACHE_TTL = 15_000 // 15 seconds
  private readonly CACHE_TTL_NEGATIVE = 5_000 // only cache "unavailable" for 5s (recover faster)
  private readonly TIMEOUT = 8_000 // 8 second timeout — DeepBrain can be slow under load
  private readonly HEALTH_TIMEOUT = 3_000 // separate shorter timeout for health check

  constructor() {
    // Load config on first use
    try {
      const config = configService.getAll()
      if (config.deepbrainPort) this.baseUrl = `http://127.0.0.1:${config.deepbrainPort}`
      if (config.deepbrainToken) this.apiToken = config.deepbrainToken
    } catch {
      // Config not ready yet, use defaults
    }

    // Auto-discover API token from DeepBrain's data directory if not configured
    if (!this.apiToken) {
      try {
        const tokenPath = join(
          homedir(),
          'Library',
          'Application Support',
          'DeepBrain',
          '.api_token'
        )
        const token = readFileSync(tokenPath, 'utf-8').trim()
        if (token) {
          this.apiToken = token
        }
      } catch {
        // Token file doesn't exist or isn't readable — DeepBrain may not be installed
      }
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
    // Check cache — use shorter TTL for negative results so we recover faster
    if (this.availableCache) {
      const ttl = this.availableCache.value ? this.CACHE_TTL : this.CACHE_TTL_NEGATIVE
      if (Date.now() - this.availableCache.timestamp < ttl) {
        return this.availableCache.value
      }
    }

    // Use a dedicated shorter timeout for the health check
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.HEALTH_TIMEOUT)

      const res = await globalThis.fetch(`${this.baseUrl}/api/health`, {
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const available = res.ok
      if (available) {
        // Only cache positive results from a successful parse
        try {
          const data = (await res.json()) as { ok?: boolean }
          const ok = data?.ok === true
          this.availableCache = { value: ok, timestamp: Date.now() }
          return ok
        } catch {
          this.availableCache = { value: true, timestamp: Date.now() }
          return true
        }
      }
      this.availableCache = { value: false, timestamp: Date.now() }
      return false
    } catch {
      this.availableCache = { value: false, timestamp: Date.now() }
      return false
    }
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

  // --- Connectors ---

  async listConnectors(): Promise<ConnectorInfo[]> {
    if (!(await this.isAvailable())) return []

    const raw = await this.fetch<Array<Record<string, unknown>>>('/api/connectors')
    if (!raw || !Array.isArray(raw)) return []

    return raw.map((r) => ({
      id: (r.id as string) || '',
      name: (r.name as string) || '',
      description: (r.description as string) || '',
      enabled: (r.enabled as boolean) || false,
      detected: (r.detected as boolean) || false,
      detectionDetails: (r.detection_details as string) || undefined,
      iconHint: (r.icon_hint as string) || undefined,
      configurable: (r.configurable as boolean) || false,
      pathOverride: (r.path_override as string) || undefined,
    }))
  }

  async updateConnectorConfig(
    id: string,
    config: { enabled?: boolean; pathOverride?: string }
  ): Promise<boolean> {
    if (!(await this.isAvailable())) return false

    const result = await this.fetch<{ ok: boolean }>(`/api/connectors/${id}/config`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled: config.enabled,
        path_override: config.pathOverride,
      }),
    })
    return result?.ok === true
  }

  async runBootstrap(sources: string[]): Promise<BootstrapResult | null> {
    if (!(await this.isAvailable())) return null

    // Bootstrap can take a while, use a longer timeout
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 120_000) // 2 minutes

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (this.apiToken) headers['Authorization'] = `Bearer ${this.apiToken}`

      const res = await globalThis.fetch(`${this.baseUrl}/api/bootstrap`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sources }),
        signal: controller.signal,
      })

      clearTimeout(timeout)
      if (!res.ok) return null

      const raw = (await res.json()) as Record<string, unknown>
      const sourcesArr = Array.isArray(raw.sources)
        ? (raw.sources as Array<Record<string, unknown>>).map((s) => ({
            source: (s.source as string) || '',
            created: (s.created as number) || 0,
            skipped: (s.skipped as number) || 0,
            errors: (s.errors as number) || 0,
          }))
        : []

      return {
        totalCreated: (raw.total_created as number) || 0,
        totalSkipped: (raw.total_skipped as number) || 0,
        totalErrors: (raw.total_errors as number) || 0,
        sources: sourcesArr,
      }
    } catch {
      return null
    }
  }

  // --- Knowledge Graph ---

  async getGraphStats(): Promise<GraphStats | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/graph/stats')
    if (!raw) return null

    return {
      nodeCount: (raw.node_count as number) || 0,
      edgeCount: (raw.edge_count as number) || 0,
      avgDegree: (raw.avg_degree as number) || 0,
      components: (raw.components as number) || 0,
    }
  }

  async getGraphNeighbors(nodeId: string, hops = 2): Promise<GraphData | null> {
    if (!(await this.isAvailable())) return null

    // API returns Vec<String> — just neighbor IDs
    const neighborIds = await this.fetch<string[]>('/api/graph/neighbors', {
      method: 'POST',
      body: JSON.stringify({ node_id: nodeId, hops }),
    })
    if (!neighborIds || !Array.isArray(neighborIds)) return null

    // Include the seed node itself
    const allIds = nodeId ? [nodeId, ...neighborIds] : neighborIds
    const idsToFetch = allIds.slice(0, 60)

    // Fetch a batch of memories to try to match IDs
    const batch = await this.fetch<Array<Record<string, unknown>>>('/api/memories', {
      method: 'POST',
      body: JSON.stringify({ offset: 0, limit: 200 }),
    })
    const batchMap = new Map<string, Record<string, unknown>>()
    if (batch && Array.isArray(batch)) {
      for (const m of batch) {
        if (m.id) batchMap.set(m.id as string, m)
      }
    }

    // Build graph nodes — use batch data when available, ID-derived label otherwise
    const nodes: GraphNode[] = idsToFetch.map((id) => {
      const mem = batchMap.get(id)
      if (mem) {
        return {
          id,
          label: ((mem.content as string) || '').slice(0, 40),
          memoryType: (mem.memory_type as string) || 'semantic',
          importance: (mem.importance as number) || 0.5,
          content: (mem.content as string) || undefined,
        }
      }
      // Derive label from ID format: "bootstrap::source::hash::idx"
      const parts = id.split('::')
      const source = parts.length >= 2 ? parts[1] : parts[0]
      return {
        id,
        label: source.replace(/_/g, ' '),
        memoryType: 'semantic',
        importance: 0.5,
      }
    })

    // Build edges: seed → each neighbor
    const edges: GraphEdge[] = neighborIds
      .filter((nid) => idsToFetch.includes(nid))
      .map((nid) => ({
        source: nodeId || idsToFetch[0] || '',
        target: nid,
        weight: 0.5,
      }))

    return { nodes, edges }
  }

  // --- Subsystem Stats ---

  async getSonaStats(): Promise<SonaStats | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/sona/stats')
    if (!raw) return null

    const loopA = (raw.loop_a || raw.loopA || {}) as Record<string, unknown>
    const loopB = (raw.loop_b || raw.loopB || {}) as Record<string, unknown>
    const loopC = (raw.loop_c || raw.loopC || {}) as Record<string, unknown>

    return {
      loopA: {
        active: (loopA.active as boolean) || false,
        gradientNorm: (loopA.gradient_norm as number) || 0,
        microLoraCount: (loopA.micro_lora_count as number) || 0,
      },
      loopB: {
        active: (loopB.active as boolean) || false,
        clusterCount: (loopB.cluster_count as number) || 0,
        lastRun: (loopB.last_run as string) || undefined,
      },
      loopC: {
        active: (loopC.active as boolean) || false,
        ewcPenalty: (loopC.ewc_penalty as number) || 0,
        lastRun: (loopC.last_run as string) || undefined,
      },
    }
  }

  async getNervousStats(): Promise<NervousStats | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/nervous/stats')
    if (!raw) return null

    return {
      routerSync: (raw.router_sync as number) || 0,
      hopfieldEnergy: (raw.hopfield_energy as number) || 0,
      oscillatorPhase: (raw.oscillator_phase as number) || 0,
      predictiveCodingError: (raw.predictive_coding_error as number) || 0,
    }
  }

  async getStorageHealth(): Promise<StorageHealth | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/storage/health')
    if (!raw) return null

    return {
      hotTierSize: (raw.hot_tier_size as number) || 0,
      warmTierSize: (raw.warm_tier_size as number) || 0,
      coldTierSize: (raw.cold_tier_size as number) || 0,
      totalSize: (raw.total_size as number) || 0,
      fragmentationRatio: (raw.fragmentation_ratio as number) || 0,
    }
  }

  async getCompressionStats(): Promise<CompressionStats | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/compression/stats')
    if (!raw) return null

    return {
      hotTierSize: (raw.hot_tier_size as number) || 0,
      warmTierSize: (raw.warm_tier_size as number) || 0,
      coldTierSize: (raw.cold_tier_size as number) || 0,
      compressionRatio: (raw.compression_ratio as number) || 0,
      totalRecords: (raw.total_records as number) || 0,
    }
  }

  async getLlmStatus(): Promise<LlmStatus | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/llm/status')
    if (!raw) return null

    return {
      loaded: (raw.loaded as boolean) || false,
      backend: (raw.backend as string) || 'none',
      modelName: (raw.model_name as string) || '',
      memoryUsageMb: (raw.memory_usage_mb as number) || 0,
      tokensProcessed: (raw.tokens_processed as number) || 0,
    }
  }

  // --- Memory CRUD ---

  async listMemories(
    type?: string,
    offset = 0,
    limit = 50
  ): Promise<MemoryListResult> {
    if (!(await this.isAvailable())) return { items: [], total: 0, offset, limit }

    // API returns a flat array of MemoryBrowseItem
    const raw = await this.fetch<Array<Record<string, unknown>>>('/api/memories', {
      method: 'POST',
      body: JSON.stringify({
        memory_type: type || undefined,
        offset,
        limit,
      }),
    })
    if (!raw || !Array.isArray(raw)) return { items: [], total: 0, offset, limit }

    const items = raw.map((m) => ({
      id: (m.id as string) || '',
      content: (m.content as string) || '',
      memoryType: (m.memory_type as string) || 'semantic',
      importance: (m.importance as number) || 0.5,
      createdAt: m.timestamp ? new Date(m.timestamp as number).toISOString() : undefined,
    }))

    // The API doesn't return total count — estimate: if we got a full page, there are likely more
    const estimatedTotal = items.length >= limit ? offset + limit + 1 : offset + items.length

    return {
      items,
      total: estimatedTotal,
      offset,
      limit,
    }
  }

  async deleteMemory(id: string): Promise<boolean> {
    if (!(await this.isAvailable())) return false

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.TIMEOUT)

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (this.apiToken) headers['Authorization'] = `Bearer ${this.apiToken}`

      const res = await globalThis.fetch(
        `${this.baseUrl}/api/memories/${encodeURIComponent(id)}`,
        { method: 'DELETE', headers, signal: controller.signal }
      )
      clearTimeout(timeout)
      return res.status === 204 || res.ok
    } catch {
      return false
    }
  }

  // --- Brain Actions ---

  async brainCycle(): Promise<BrainCycleResult | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/brain/cycle', {
      method: 'POST',
    })
    if (!raw) return null

    return {
      cycleNumber: (raw.cycle_number as number) || 0,
      trainingInsights: Array.isArray(raw.training_insights)
        ? (raw.training_insights as string[])
        : [],
      memoriesPruned: (raw.memories_pruned as number) || 0,
    }
  }

  async brainEvolve(): Promise<BrainEvolveResult | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/brain/evolve', {
      method: 'POST',
    })
    if (!raw) return null

    return {
      adaptations: Array.isArray(raw.adaptations) ? (raw.adaptations as string[]) : [],
      improvements: Array.isArray(raw.improvements) ? (raw.improvements as string[]) : [],
      thoughtId: (raw.thought_id as string) || undefined,
    }
  }

  async brainFlush(): Promise<boolean> {
    if (!(await this.isAvailable())) return false

    const result = await this.fetch<{ ok: boolean }>('/api/brain/flush', {
      method: 'POST',
    })
    return result?.ok === true
  }

  // --- BrainWire Cognitive Memory ---

  async brainwireConsolidate(): Promise<BrainwireConsolidationResult | null> {
    if (!(await this.isAvailable())) return null

    // Consolidation processes all memories with AI — can take 5-10+ minutes for large stores
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 600_000) // 10 minutes

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (this.apiToken) headers['Authorization'] = `Bearer ${this.apiToken}`

      const res = await globalThis.fetch(`${this.baseUrl}/api/brainwire/consolidate`, {
        method: 'POST',
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeout)
      if (!res.ok) return null

      const raw = (await res.json()) as Record<string, unknown>
      return {
        memoriesProcessed: (raw.memories_processed as number) || 0,
        clustersFound: (raw.clusters_found as number) || 0,
        memoriesConsolidated: (raw.memories_consolidated as number) || 0,
        newAbstractions: (raw.new_abstractions as number) || 0,
        memoriesDecayed: (raw.memories_decayed as number) || 0,
      }
    } catch {
      return null
    }
  }

  async brainwireStatus(): Promise<BrainwireStatus | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/brainwire/status')
    if (!raw) return null

    return {
      totalMemories: (raw.total_memories as number) || 0,
      activeMemories: (raw.active_memories as number) || 0,
      dormantMemories: (raw.dormant_memories as number) || 0,
      stmEntries: (raw.stm_entries as number) || 0,
      consolidationCycles: (raw.consolidation_cycles as number) || 0,
      avgSalience: (raw.avg_salience as number) || 0,
      workingMemoryItems: (raw.working_memory_items as number) || 0,
      conceptCount: (raw.concept_count as number) || 0,
    }
  }

  async brainwireWorkingMemory(): Promise<BrainwireWorkingMemoryItem[]> {
    if (!(await this.isAvailable())) return []

    const raw = await this.fetch<{ items: Array<Record<string, unknown>> }>('/api/brainwire/working-memory')
    if (!raw?.items || !Array.isArray(raw.items)) return []

    return raw.items.map((item) => ({
      memoryId: (item.memory_id as string) || '',
      gist: (item.gist as string) || '',
      concepts: Array.isArray(item.concepts) ? (item.concepts as string[]) : [],
      activatedAt: (item.activated_at as string) || '',
      relevance: (item.relevance as number) || 0,
    }))
  }

  // --- Knowledge Export ---

  async exportKnowledge(): Promise<KnowledgeExportResult | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>('/api/brainwire/export-knowledge', {
      method: 'POST',
    })
    if (!raw) return null

    return {
      topicsWritten: (raw.topics_written as number) || 0,
      memoriesExported: (raw.memories_exported as number) || 0,
      outputPath: (raw.output_path as string) || '',
    }
  }

  async knowledgeTopics(): Promise<KnowledgeTopicsResponse> {
    if (!(await this.isAvailable())) return { topics: [], stats: null, lastExported: null }

    const raw = await this.fetch<Record<string, unknown>>('/api/brainwire/knowledge/topics')
    if (!raw) return { topics: [], stats: null, lastExported: null }

    const rawTopics = Array.isArray(raw.topics) ? (raw.topics as Record<string, unknown>[]) : []
    const topics = rawTopics.map((t) => ({
      slug: (t.slug as string) || '',
      name: (t.name as string) || '',
      sizeBytes: (t.size_bytes as number) || 0,
      modifiedTs: (t.modified_ts as number) || 0,
      memoryCount: (t.memory_count as number) || 0,
    }))

    const rawStats = raw.stats as Record<string, unknown> | null
    const stats = rawStats
      ? {
          topicsWritten: (rawStats.topics_written as number) || 0,
          memoriesExported: (rawStats.memories_exported as number) || 0,
          consolidationCycles: (rawStats.consolidation_cycles as number) || 0,
          avgSalience: (rawStats.avg_salience as number) || 0,
        }
      : null

    return {
      topics,
      stats,
      lastExported: (raw.last_exported as number) || null,
    }
  }

  async knowledgeTopic(slug: string): Promise<{ slug: string; content: string } | null> {
    if (!(await this.isAvailable())) return null

    const raw = await this.fetch<Record<string, unknown>>(`/api/brainwire/knowledge/topic/${encodeURIComponent(slug)}`)
    if (!raw) return null

    return {
      slug: (raw.slug as string) || slug,
      content: (raw.content as string) || '',
    }
  }
}

export const deepbrainService = new DeepBrainService()
