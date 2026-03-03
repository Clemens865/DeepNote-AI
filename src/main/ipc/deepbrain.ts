import { ipcMain, shell } from 'electron'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { deepbrainService } from '../services/deepbrain'
import { deepbrainDaemon } from '../services/deepbrainDaemon'
import { configService } from '../services/config'

export function registerDeepBrainHandlers() {
  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_STATUS, async () => {
    const status = await deepbrainService.getStatus()
    const enabled = configService.getAll().deepbrainEnabled !== false
    if (status) {
      return { ...status, enabled }
    }
    return { available: false, enabled, memoryCount: 0, thoughtCount: 0, aiProvider: '', aiAvailable: false, embeddingProvider: '', learningTrend: '', indexedFiles: 0, indexedChunks: 0, uptimeMs: 0 }
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_RECALL, async (_event, args: { query: string; limit?: number }) => {
    return deepbrainService.recall(args.query, args.limit)
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_SEARCH, async (_event, args: { query: string; limit?: number }) => {
    return deepbrainService.searchFiles(args.query, args.limit)
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_CLIPBOARD, async (_event, args?: { limit?: number }) => {
    return deepbrainService.getClipboardHistory(args?.limit)
  })

  ipcMain.handle(
    IPC_CHANNELS.DEEPBRAIN_REMEMBER,
    async (_event, args: { content: string; memoryType?: string; importance?: number }) => {
      return deepbrainService.remember(
        args.content,
        (args.memoryType as import('../services/deepbrain').MemoryType) || 'semantic',
        args.importance
      )
    }
  )

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_THINK, async (_event, args: { input: string }) => {
    return deepbrainService.think(args.input)
  })

  ipcMain.handle(
    IPC_CHANNELS.DEEPBRAIN_CONFIGURE,
    async (_event, args: { port?: number; token?: string | null; enabled?: boolean }) => {
      if (args.port) deepbrainService.setPort(args.port)
      if (args.token !== undefined) deepbrainService.setApiToken(args.token)
      if (args.enabled !== undefined) configService.setConfig({ deepbrainEnabled: args.enabled })
    }
  )

  // System: open file in default app
  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_FILE, async (_event, args: { filePath: string }) => {
    try {
      const resolved = resolve(args.filePath)
      if (!existsSync(resolved)) {
        return { success: false, error: 'File not found' }
      }
      await shell.openPath(resolved)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // DeepBrain: email search
  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_SEARCH_EMAILS, async (_event, args: { query: string; limit?: number }) => {
    return deepbrainService.searchEmails(args.query, args.limit)
  })

  // DeepBrain: current activity
  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_ACTIVITY_CURRENT, async () => {
    return deepbrainService.getActivityCurrent()
  })

  // --- Control Center handlers ---

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_CONNECTORS, async () => {
    return deepbrainService.listConnectors()
  })

  ipcMain.handle(
    IPC_CHANNELS.DEEPBRAIN_CONNECTOR_CONFIG,
    async (_event, args: { id: string; enabled?: boolean; pathOverride?: string }) => {
      return deepbrainService.updateConnectorConfig(args.id, {
        enabled: args.enabled,
        pathOverride: args.pathOverride,
      })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DEEPBRAIN_BOOTSTRAP,
    async (_event, args: { sources: string[] }) => {
      return deepbrainService.runBootstrap(args.sources)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_GRAPH_STATS, async () => {
    return deepbrainService.getGraphStats()
  })

  ipcMain.handle(
    IPC_CHANNELS.DEEPBRAIN_GRAPH_NEIGHBORS,
    async (_event, args: { nodeId: string; hops?: number }) => {
      return deepbrainService.getGraphNeighbors(args.nodeId, args.hops)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_SONA_STATS, async () => {
    return deepbrainService.getSonaStats()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_NERVOUS_STATS, async () => {
    return deepbrainService.getNervousStats()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_STORAGE_HEALTH, async () => {
    return deepbrainService.getStorageHealth()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_COMPRESSION_STATS, async () => {
    return deepbrainService.getCompressionStats()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_LLM_STATUS, async () => {
    return deepbrainService.getLlmStatus()
  })

  ipcMain.handle(
    IPC_CHANNELS.DEEPBRAIN_MEMORIES,
    async (_event, args: { type?: string; offset?: number; limit?: number }) => {
      return deepbrainService.listMemories(args.type, args.offset, args.limit)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DEEPBRAIN_MEMORY_DELETE,
    async (_event, args: { id: string }) => {
      return deepbrainService.deleteMemory(args.id)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_BRAIN_CYCLE, async () => {
    return deepbrainService.brainCycle()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_BRAIN_EVOLVE, async () => {
    return deepbrainService.brainEvolve()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_BRAIN_FLUSH, async () => {
    return deepbrainService.brainFlush()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_BRAINWIRE_CONSOLIDATE, async () => {
    return deepbrainService.brainwireConsolidate()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_BRAINWIRE_STATUS, async () => {
    return deepbrainService.brainwireStatus()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_BRAINWIRE_WORKING_MEMORY, async () => {
    return deepbrainService.brainwireWorkingMemory()
  })

  // Knowledge Export
  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_EXPORT_KNOWLEDGE, async () => {
    return deepbrainService.exportKnowledge()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_KNOWLEDGE_TOPICS, async () => {
    return deepbrainService.knowledgeTopics()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_KNOWLEDGE_TOPIC, async (_event, args: { slug: string }) => {
    return deepbrainService.knowledgeTopic(args.slug)
  })

  // DeepBrain Daemon status
  ipcMain.handle(IPC_CHANNELS.DEEPBRAIN_DAEMON_STATUS, async () => {
    return deepbrainDaemon.getState()
  })

  ipcMain.handle(IPC_CHANNELS.DEEPNOTE_API_STATUS, async () => {
    const { deepnoteApiServer } = await import('../services/deepnoteApi')
    return {
      port: deepnoteApiServer.getPort(),
    }
  })
}
