import { ipcMain, dialog } from 'electron'
import { resolve } from 'path'
import { eq, and } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { vectorStoreService } from '../services/vectorStore'
import { ingestSource } from '../services/sourceIngestion'
import {
  validateAndResolve,
  classifyFile,
  scanDirectory,
  buildTree,
  computeDiff,
  getManifest,
  applyDiff,
  readWorkspaceFile,
  writeWorkspaceFile,
  createWorkspaceFile,
  deleteWorkspaceFile,
  createWorkspaceDirectory,
} from '../services/workspace'
import type { WorkspaceFile } from '../../shared/types'

function getNotebookWithRoot(notebookId: string) {
  const db = getDatabase()
  const rows = db.select().from(schema.notebooks).where(eq(schema.notebooks.id, notebookId)).all()
  if (rows.length === 0) throw new Error('Notebook not found')
  const nb = rows[0]
  if (!nb.workspaceRootPath) throw new Error('Notebook is not linked to a workspace')
  return nb
}

export function registerWorkspaceHandlers() {
  // Directory picker dialog
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Link a notebook to a workspace folder
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_LINK,
    async (_event, args: { notebookId: string; rootPath: string }) => {
      const db = getDatabase()
      const rootPath = resolve(args.rootPath)
      const now = new Date().toISOString()

      await db
        .update(schema.notebooks)
        .set({ workspaceRootPath: rootPath, updatedAt: now })
        .where(eq(schema.notebooks.id, args.notebookId))

      // Do initial scan and populate manifest
      const scanned = scanDirectory(rootPath)
      const manifest = getManifest(args.notebookId)
      const diff = computeDiff(scanned, manifest)
      applyDiff(args.notebookId, scanned, diff)

      const rows = await db.select().from(schema.notebooks).where(eq(schema.notebooks.id, args.notebookId))
      return rows[0]
    }
  )

  // Unlink workspace from notebook
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_UNLINK, async (_event, notebookId: string) => {
    const db = getDatabase()
    const now = new Date().toISOString()

    // Delete all workspace_files entries (sources remain)
    await db.delete(schema.workspaceFiles).where(eq(schema.workspaceFiles.notebookId, notebookId))

    await db
      .update(schema.notebooks)
      .set({ workspaceRootPath: null, updatedAt: now })
      .where(eq(schema.notebooks.id, notebookId))

    const rows = await db.select().from(schema.notebooks).where(eq(schema.notebooks.id, notebookId))
    return rows[0]
  })

  // Get file tree
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SCAN, async (_event, notebookId: string) => {
    const nb = getNotebookWithRoot(notebookId)
    const scanned = scanDirectory(nb.workspaceRootPath!)
    const manifest = getManifest(notebookId)

    // Also apply diff to keep manifest in sync
    const diff = computeDiff(scanned, manifest)
    if (diff.added.length > 0 || diff.modified.length > 0 || diff.deleted.length > 0) {
      applyDiff(notebookId, scanned, diff)
    }

    // Rebuild manifest after applying diff
    const updatedManifest = getManifest(notebookId)
    return buildTree(scanned, updatedManifest)
  })

  // Detect changes (diff only, no apply)
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DIFF, async (_event, notebookId: string) => {
    const nb = getNotebookWithRoot(notebookId)
    const scanned = scanDirectory(nb.workspaceRootPath!)
    const manifest = getManifest(notebookId)
    return computeDiff(scanned, manifest)
  })

  // Select a file for indexing
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SELECT,
    async (_event, args: { notebookId: string; relativePath: string }) => {
      const nb = getNotebookWithRoot(args.notebookId)
      const db = getDatabase()
      const absPath = validateAndResolve(nb.workspaceRootPath!, args.relativePath)
      const classification = classifyFile(args.relativePath)

      if (!classification.isIndexable || !classification.sourceType) {
        throw new Error('File type is not indexable')
      }

      // Ingest as a source
      const source = await ingestSource({
        notebookId: args.notebookId,
        type: classification.sourceType,
        filePath: absPath,
        title: args.relativePath.split('/').pop() || args.relativePath,
      })

      // Update workspace_files manifest
      const now = new Date().toISOString()
      await db
        .update(schema.workspaceFiles)
        .set({ sourceId: source.id, status: 'indexed', updatedAt: now })
        .where(
          and(
            eq(schema.workspaceFiles.notebookId, args.notebookId),
            eq(schema.workspaceFiles.relativePath, args.relativePath)
          )
        )

      return source
    }
  )

  // Deselect a file (remove its source)
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_DESELECT,
    async (_event, args: { notebookId: string; relativePath: string }) => {
      const db = getDatabase()
      const now = new Date().toISOString()

      // Find the workspace file entry
      const wfRows = db
        .select()
        .from(schema.workspaceFiles)
        .where(
          and(
            eq(schema.workspaceFiles.notebookId, args.notebookId),
            eq(schema.workspaceFiles.relativePath, args.relativePath)
          )
        )
        .all()

      const wf = wfRows[0] as WorkspaceFile | undefined
      if (wf?.sourceId) {
        // Delete vectors
        await vectorStoreService.deleteSource(args.notebookId, wf.sourceId)
        // Delete source (chunks cascade)
        await db.delete(schema.sources).where(eq(schema.sources.id, wf.sourceId))
      }

      // Update manifest entry
      await db
        .update(schema.workspaceFiles)
        .set({ sourceId: null, status: 'unindexed', updatedAt: now })
        .where(
          and(
            eq(schema.workspaceFiles.notebookId, args.notebookId),
            eq(schema.workspaceFiles.relativePath, args.relativePath)
          )
        )
    }
  )

  // Read a file
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_READ,
    async (_event, args: { notebookId: string; relativePath: string }) => {
      const nb = getNotebookWithRoot(args.notebookId)
      const classification = classifyFile(args.relativePath)
      const content = readWorkspaceFile(nb.workspaceRootPath!, args.relativePath)
      return { content, isText: classification.isText }
    }
  )

  // Write a file
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_WRITE,
    async (_event, args: { notebookId: string; relativePath: string; content: string }) => {
      const nb = getNotebookWithRoot(args.notebookId)
      const db = getDatabase()
      writeWorkspaceFile(nb.workspaceRootPath!, args.relativePath, args.content)

      // If file was indexed, mark as stale
      const now = new Date().toISOString()
      const wfRows = db
        .select()
        .from(schema.workspaceFiles)
        .where(
          and(
            eq(schema.workspaceFiles.notebookId, args.notebookId),
            eq(schema.workspaceFiles.relativePath, args.relativePath)
          )
        )
        .all()

      const wf = wfRows[0] as WorkspaceFile | undefined
      if (wf && wf.status === 'indexed') {
        await db
          .update(schema.workspaceFiles)
          .set({ status: 'stale', updatedAt: now })
          .where(eq(schema.workspaceFiles.id, wf.id))
      }
    }
  )

  // Create a new file
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_CREATE_FILE,
    async (_event, args: { notebookId: string; relativePath: string; content?: string }) => {
      const nb = getNotebookWithRoot(args.notebookId)
      createWorkspaceFile(nb.workspaceRootPath!, args.relativePath, args.content)
    }
  )

  // Delete a file
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_DELETE_FILE,
    async (_event, args: { notebookId: string; relativePath: string }) => {
      const nb = getNotebookWithRoot(args.notebookId)
      const db = getDatabase()

      // Clean up source if indexed
      const wfRows = db
        .select()
        .from(schema.workspaceFiles)
        .where(
          and(
            eq(schema.workspaceFiles.notebookId, args.notebookId),
            eq(schema.workspaceFiles.relativePath, args.relativePath)
          )
        )
        .all()

      const wf = wfRows[0] as WorkspaceFile | undefined
      if (wf?.sourceId) {
        await vectorStoreService.deleteSource(args.notebookId, wf.sourceId)
        await db.delete(schema.sources).where(eq(schema.sources.id, wf.sourceId))
      }

      // Delete manifest entry
      if (wf) {
        await db.delete(schema.workspaceFiles).where(eq(schema.workspaceFiles.id, wf.id))
      }

      // Delete from filesystem
      deleteWorkspaceFile(nb.workspaceRootPath!, args.relativePath)
    }
  )

  // Create a directory
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_CREATE_DIR,
    async (_event, args: { notebookId: string; relativePath: string }) => {
      const nb = getNotebookWithRoot(args.notebookId)
      createWorkspaceDirectory(nb.workspaceRootPath!, args.relativePath)
    }
  )

  // List manifest entries
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_FILES, async (_event, notebookId: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.workspaceFiles)
      .where(eq(schema.workspaceFiles.notebookId, notebookId))
      .all()
  })

  // Sync: re-index stale files, remove deleted sources
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SYNC, async (_event, notebookId: string) => {
    const nb = getNotebookWithRoot(notebookId)
    const db = getDatabase()
    const now = new Date().toISOString()

    // First, scan and apply diff to detect changes
    const scanned = scanDirectory(nb.workspaceRootPath!)
    const manifest = getManifest(notebookId)
    const diff = computeDiff(scanned, manifest)

    // Handle deleted files — remove their sources
    let removed = 0
    for (const path of diff.deleted) {
      const wf = manifest.get(path)
      if (wf?.sourceId) {
        await vectorStoreService.deleteSource(notebookId, wf.sourceId)
        await db.delete(schema.sources).where(eq(schema.sources.id, wf.sourceId))
        removed++
      }
    }

    applyDiff(notebookId, scanned, diff)

    // Re-index stale files
    const updatedManifest = getManifest(notebookId)
    let reindexed = 0

    for (const [path, wf] of updatedManifest) {
      if (wf.status !== 'stale') continue
      if (!wf.sourceId) continue

      const classification = classifyFile(path)
      if (!classification.isIndexable || !classification.sourceType) continue

      try {
        // Delete old source
        await vectorStoreService.deleteSource(notebookId, wf.sourceId)
        await db.delete(schema.sources).where(eq(schema.sources.id, wf.sourceId))

        // Re-ingest
        const absPath = validateAndResolve(nb.workspaceRootPath!, path)
        const source = await ingestSource({
          notebookId,
          type: classification.sourceType,
          filePath: absPath,
          title: path.split('/').pop() || path,
        })

        // Update manifest
        await db
          .update(schema.workspaceFiles)
          .set({ sourceId: source.id, status: 'indexed', updatedAt: now })
          .where(eq(schema.workspaceFiles.id, wf.id))

        reindexed++
      } catch (err) {
        console.warn(`[Workspace] Failed to re-index ${path}:`, err)
        await db
          .update(schema.workspaceFiles)
          .set({ status: 'error', updatedAt: now })
          .where(eq(schema.workspaceFiles.id, wf.id))
      }
    }

    return { reindexed, removed }
  })

  // AI rewrite selected text
  ipcMain.handle(
    IPC_CHANNELS.EDITOR_AI_REWRITE,
    async (_event, args: { selectedText: string; instruction: string; fullContent: string; filePath: string }) => {
      const { GoogleGenAI } = await import('@google/genai')
      const { configService } = await import('../services/config')

      const apiKey = configService.getApiKey()
      if (!apiKey) throw new Error('Gemini API key not configured. Please set it in Settings.')

      const ai = new GoogleGenAI({ apiKey })

      const ext = args.filePath.split('.').pop()?.toLowerCase() || ''
      const langHint = ext === 'md' || ext === 'markdown' ? 'Markdown' : ext === 'json' ? 'JSON' : 'plain text'

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are an AI writing assistant helping edit a ${langHint} file.

The user has selected the following text from the file "${args.filePath}":

---SELECTED TEXT---
${args.selectedText}
---END SELECTED TEXT---

The user's instruction: "${args.instruction}"

Return ONLY the rewritten text that should replace the selected text. Do not include any explanation, markdown code fences, or anything else — just the replacement text itself. Preserve the same formatting style (indentation, line breaks, etc.) as the original.`,
              },
            ],
          },
        ],
      })

      const rewrittenText = response.text?.trim() || args.selectedText
      return { rewrittenText }
    }
  )
}
