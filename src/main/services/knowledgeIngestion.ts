/**
 * Knowledge Ingestion — orchestrates folder scan → parse → chunk → embed → store.
 */

import { eq } from 'drizzle-orm'
import { statSync } from 'fs'
import { basename, extname } from 'path'
import { BrowserWindow } from 'electron'
import { getDatabase, schema } from '../db'
import { scanFolder } from './fileConnector'
import { documentParserService } from './documentParser'
import { chunkerService } from './chunker'
import { knowledgeStoreService } from './knowledgeStore'

interface IngestionResult {
  filesScanned: number
  chunksCreated: number
  skipped: number
  errors: number
}

function broadcastProgress(stage: string, message: string, current?: number, total?: number): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('knowledge:scan-progress', { stage, message, current, total })
  })
}

/**
 * Parse a single file based on its extension.
 */
async function parseFile(filePath: string): Promise<{ text: string; title: string } | null> {
  const ext = extname(filePath).toLowerCase()
  try {
    switch (ext) {
      case '.pdf':
        return await documentParserService.parsePDF(filePath)
      case '.docx':
      case '.doc':
        return await documentParserService.parseDocx(filePath)
      case '.txt':
      case '.md':
      case '.rtf':
        return await documentParserService.parseText(filePath)
      case '.xlsx':
      case '.csv':
        return await documentParserService.parseExcel(filePath)
      case '.pptx':
        return await documentParserService.parsePptx(filePath)
      default:
        return await documentParserService.parseText(filePath)
    }
  } catch (err) {
    console.warn(`[KnowledgeIngestion] Failed to parse ${filePath}:`, err)
    return null
  }
}

/**
 * Small delay to relieve memory pressure between batches.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Ingest a single file into the knowledge store.
 * Processes chunks in batches to avoid memory pressure from embedding buffers.
 */
export async function ingestFile(filePath: string): Promise<{ chunks: number; skipped: boolean }> {
  const parsed = await parseFile(filePath)
  if (!parsed || !parsed.text.trim()) {
    return { chunks: 0, skipped: true }
  }

  const chunks = chunkerService.chunk(parsed.text, { chunkSize: 500, overlap: 100 })
  let created = 0
  const BATCH_SIZE = 5

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    for (const chunk of batch) {
      if (chunk.text.trim().length < 20) continue
      try {
        const result = await knowledgeStoreService.add(chunk.text, {
          type: 'document',
          sourcePath: filePath,
          sourceTitle: parsed.title || basename(filePath),
          tags: [extname(filePath).slice(1)],
        })
        if (result) created++
      } catch (err) {
        console.warn(`[KnowledgeIngestion] Failed to add chunk from ${filePath}:`, err)
      }
    }
    // Let GC reclaim embedding buffers between batches
    if (i + BATCH_SIZE < chunks.length) {
      await sleep(10)
    }
  }

  return { chunks: created, skipped: created === 0 }
}

/**
 * Ingest all files from a configured folder.
 */
export async function ingestFolder(folderId: string): Promise<IngestionResult> {
  const db = getDatabase()

  const folder = db
    .select()
    .from(schema.knowledgeFolders)
    .where(eq(schema.knowledgeFolders.id, folderId))
    .get()

  if (!folder) throw new Error(`Folder not found: ${folderId}`)

  broadcastProgress('scanning', `Scanning ${folder.path}...`)
  const files = scanFolder(folder.path)

  const result: IngestionResult = {
    filesScanned: files.length,
    chunksCreated: 0,
    skipped: 0,
    errors: 0,
  }

  broadcastProgress('indexing', `Found ${files.length} files`, 0, files.length)

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    broadcastProgress('indexing', `Indexing: ${file.name}`, i + 1, files.length)

    try {
      // Check if file exists
      const existingStat = (() => {
        try { return statSync(file.path) } catch { return null }
      })()
      if (!existingStat) {
        result.errors++
        continue
      }

      const ingested = await ingestFile(file.path)
      if (ingested.skipped) {
        result.skipped++
      } else {
        result.chunksCreated += ingested.chunks
      }
    } catch (err) {
      console.warn(`[KnowledgeIngestion] Error processing ${file.path}:`, err)
      result.errors++
    }

    // Yield between files to relieve memory pressure
    if (i % 5 === 4) {
      await sleep(50)
    }
  }

  // Update folder metadata
  db.update(schema.knowledgeFolders)
    .set({
      fileCount: files.length,
      lastScanAt: Date.now(),
    })
    .where(eq(schema.knowledgeFolders.id, folderId))
    .run()

  broadcastProgress('complete', `Scan complete: ${result.chunksCreated} chunks from ${result.filesScanned} files`)

  return result
}
