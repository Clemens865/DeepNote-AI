/**
 * Knowledge Store IPC handlers.
 */

import { ipcMain, dialog, shell } from 'electron'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { knowledgeStoreService } from '../services/knowledgeStore'
import { ingestFolder } from '../services/knowledgeIngestion'
import { configService } from '../services/config'
import type { KnowledgeType } from '../services/knowledgeStore'

export function registerKnowledgeHandlers(): void {
  // Status
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_STATUS, async () => {
    const config = configService.getAll()
    const stats = knowledgeStoreService.getStats()
    return {
      enabled: config.knowledgeEnabled !== false,
      ...stats,
    }
  })

  // Search
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_SEARCH, async (_event, args: { query: string; limit?: number }) => {
    const results = await knowledgeStoreService.search(args.query, args.limit || 10)
    return results.map((r) => ({
      id: r.id,
      content: r.content,
      type: r.type,
      similarity: r.similarity,
      sourceTitle: r.sourceTitle,
    }))
  })

  // Add
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_ADD, async (_event, args: { content: string; type?: string; importance?: number; tags?: string[] }) => {
    const result = await knowledgeStoreService.add(args.content, {
      type: (args.type as KnowledgeType) || 'manual',
      importance: args.importance,
      tags: args.tags,
    })
    return result ? { id: result.id } : null
  })

  // List
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_LIST, async (_event, args: { type?: string; offset?: number; limit?: number }) => {
    const result = knowledgeStoreService.list({
      type: args.type as KnowledgeType | undefined,
      offset: args.offset,
      limit: args.limit,
    })
    return {
      items: result.items.map((item) => ({
        id: item.id,
        content: item.content,
        type: item.type,
        importance: item.importance,
        sourceTitle: item.sourceTitle,
        tags: item.tags,
        createdAt: item.createdAt,
      })),
      total: result.total,
    }
  })

  // Delete
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_DELETE, async (_event, args: { id: string }) => {
    return knowledgeStoreService.delete(args.id)
  })

  // Folders — Get
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_FOLDERS_GET, async () => {
    const db = getDatabase()
    const folders = db.select().from(schema.knowledgeFolders).all()
    return folders.map((f) => ({
      id: f.id,
      path: f.path,
      fileCount: f.fileCount,
      lastScanAt: f.lastScanAt,
      enabled: f.enabled,
    }))
  })

  // Folders — Add (opens directory dialog)
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_FOLDERS_ADD, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select folder to index',
    })

    if (result.canceled || !result.filePaths[0]) return null

    const folderPath = result.filePaths[0]
    const db = getDatabase()

    // Check if already exists
    const existing = db
      .select()
      .from(schema.knowledgeFolders)
      .where(eq(schema.knowledgeFolders.path, folderPath))
      .get()
    if (existing) return { id: existing.id, path: existing.path }

    const id = randomUUID()
    db.insert(schema.knowledgeFolders).values({
      id,
      path: folderPath,
      fileCount: 0,
      lastScanAt: null,
      enabled: true,
      createdAt: Date.now(),
    }).run()

    return { id, path: folderPath }
  })

  // Folders — Remove
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_FOLDERS_REMOVE, async (_event, args: { id: string }) => {
    const db = getDatabase()
    const result = db
      .delete(schema.knowledgeFolders)
      .where(eq(schema.knowledgeFolders.id, args.id))
      .run()
    return result.changes > 0
  })

  // Scan folder
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_SCAN, async (_event, args: { folderId: string }) => {
    return await ingestFolder(args.folderId)
  })

  // Graph
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_GRAPH, async (_event, args: { seedId?: string; hops?: number }) => {
    return await knowledgeStoreService.getGraph(args.seedId, args.hops)
  })

  // Configure (enable/disable)
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_CONFIGURE, async (_event, args: { enabled: boolean }) => {
    configService.setConfig({ knowledgeEnabled: args.enabled })
  })

  // System: open file
  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_FILE, async (_event, args: { filePath: string }) => {
    try {
      await shell.openPath(args.filePath)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
