import { ipcMain, dialog, app } from 'electron'
import { randomUUID } from 'crypto'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { eq, desc } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { vectorStoreService } from '../services/vectorStore'
import { scanDirectory, computeDiff, getManifest, applyDiff } from '../services/workspace'

export function registerNotebookHandlers() {
  ipcMain.handle(IPC_CHANNELS.NOTEBOOKS_LIST, async () => {
    const db = getDatabase()
    const rows = await db.select().from(schema.notebooks).orderBy(desc(schema.notebooks.updatedAt))

    const notebooksWithCounts = await Promise.all(
      rows.map(async (nb) => {
        const sourceRows = await db
          .select()
          .from(schema.sources)
          .where(eq(schema.sources.notebookId, nb.id))
        return { ...nb, sourceCount: sourceRows.length }
      })
    )

    return notebooksWithCounts
  })

  ipcMain.handle(IPC_CHANNELS.NOTEBOOKS_CREATE, async (_event, args: { title: string; emoji: string; workspaceRootPath?: string }) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = randomUUID()

    const notebook = {
      id,
      title: args.title,
      emoji: args.emoji,
      description: '',
      chatMode: 'auto' as const,
      responseLength: 'medium' as const,
      workspaceRootPath: args.workspaceRootPath || null,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(schema.notebooks).values(notebook)

    // If workspace-backed, do initial scan
    if (args.workspaceRootPath) {
      const scanned = scanDirectory(args.workspaceRootPath)
      const manifest = getManifest(id)
      const diff = computeDiff(scanned, manifest)
      applyDiff(id, scanned, diff)
    }

    return { ...notebook, sourceCount: 0 }
  })

  ipcMain.handle(IPC_CHANNELS.NOTEBOOKS_GET, async (_event, id: string) => {
    const db = getDatabase()
    const rows = await db.select().from(schema.notebooks).where(eq(schema.notebooks.id, id))
    if (rows.length === 0) return null

    const sourceRows = await db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.notebookId, id))

    return { ...rows[0], sourceCount: sourceRows.length }
  })

  ipcMain.handle(
    IPC_CHANNELS.NOTEBOOKS_UPDATE,
    async (_event, id: string, data: Record<string, unknown>) => {
      const db = getDatabase()
      const now = new Date().toISOString()

      await db
        .update(schema.notebooks)
        .set({ ...data, updatedAt: now })
        .where(eq(schema.notebooks.id, id))

      const rows = await db.select().from(schema.notebooks).where(eq(schema.notebooks.id, id))
      return rows[0]
    }
  )

  ipcMain.handle(IPC_CHANNELS.NOTEBOOKS_DELETE, async (_event, id: string) => {
    const db = getDatabase()
    await vectorStoreService.deleteNotebook(id)
    await db.delete(schema.notebooks).where(eq(schema.notebooks.id, id))
  })

  ipcMain.handle(
    IPC_CHANNELS.NOTEBOOK_UPLOAD_COVER,
    async (_event, notebookId: string, base64Data: string) => {
      const coversDir = join(app.getPath('userData'), 'notebook-covers')
      if (!existsSync(coversDir)) {
        mkdirSync(coversDir, { recursive: true })
      }

      const filePath = join(coversDir, `${notebookId}.png`)

      // Remove data URI prefix if present
      const raw = base64Data.replace(/^data:image\/\w+;base64,/, '')
      writeFileSync(filePath, Buffer.from(raw, 'base64'))

      const db = getDatabase()
      const now = new Date().toISOString()
      await db
        .update(schema.notebooks)
        .set({ cardBgImage: filePath, updatedAt: now })
        .where(eq(schema.notebooks.id, notebookId))

      return filePath
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTEBOOKS_EXPORT,
    async (_event, args: { notebookId: string; format: 'json' | 'html' }) => {
      const db = getDatabase()

      // Query all data for this notebook
      const nbRows = await db.select().from(schema.notebooks).where(eq(schema.notebooks.id, args.notebookId))
      if (nbRows.length === 0) throw new Error('Notebook not found')
      const notebook = nbRows[0]

      const sources = await db.select().from(schema.sources).where(eq(schema.sources.notebookId, args.notebookId))
      const notes = await db.select().from(schema.notes).where(eq(schema.notes.notebookId, args.notebookId))
      const messages = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.notebookId, args.notebookId))
      const generated = await db.select().from(schema.generatedContent).where(eq(schema.generatedContent.notebookId, args.notebookId))

      const ext = args.format === 'json' ? 'json' : 'html'
      const result = await dialog.showSaveDialog({
        defaultPath: `${notebook.title.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`,
        filters: [
          args.format === 'json'
            ? { name: 'JSON Files', extensions: ['json'] }
            : { name: 'HTML Files', extensions: ['html'] },
        ],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, filePath: '' }
      }

      if (args.format === 'json') {
        const exportData = {
          notebook,
          sources: sources.map((s) => ({ id: s.id, title: s.title, type: s.type, content: s.content, sourceGuide: s.sourceGuide })),
          notes: notes.map((n) => ({ id: n.id, title: n.title, content: n.content })),
          chatMessages: messages.map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt })),
          generatedContent: generated.map((g) => ({ type: g.type, title: g.title, data: g.data, status: g.status })),
          exportedAt: new Date().toISOString(),
        }
        writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
      } else {
        const html = buildHtmlExport(notebook, sources, notes, messages, generated)
        writeFileSync(result.filePath, html, 'utf-8')
      }

      return { success: true, filePath: result.filePath }
    }
  )
}

function buildHtmlExport(
  notebook: Record<string, unknown>,
  sources: Array<Record<string, unknown>>,
  notes: Array<Record<string, unknown>>,
  messages: Array<Record<string, unknown>>,
  generated: Array<Record<string, unknown>>
): string {
  const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  let sourcesHtml = ''
  if (sources.length > 0) {
    sourcesHtml = `<h2>Sources (${sources.length})</h2>` +
      sources.map((s) =>
        `<div class="card"><h3>${esc(s.title)}</h3><p class="meta">Type: ${esc(s.type)}</p>${s.sourceGuide ? `<p class="guide">${esc(s.sourceGuide)}</p>` : ''}<pre>${esc(String(s.content).slice(0, 2000))}${String(s.content).length > 2000 ? '...' : ''}</pre></div>`
      ).join('')
  }

  let notesHtml = ''
  if (notes.length > 0) {
    notesHtml = `<h2>Notes (${notes.length})</h2>` +
      notes.map((n) =>
        `<div class="card"><h3>${esc(n.title)}</h3><p>${esc(n.content)}</p></div>`
      ).join('')
  }

  let chatHtml = ''
  if (messages.length > 0) {
    chatHtml = `<h2>Chat History (${messages.length} messages)</h2>` +
      messages.map((m) =>
        `<div class="card ${m.role === 'assistant' ? 'assistant' : 'user'}"><p class="meta">${esc(m.role)} &mdash; ${esc(m.createdAt)}</p><p>${esc(m.content)}</p></div>`
      ).join('')
  }

  let generatedHtml = ''
  if (generated.length > 0) {
    generatedHtml = `<h2>Generated Content (${generated.length})</h2>` +
      generated.map((g) =>
        `<div class="card"><h3>${esc(g.title)}</h3><p class="meta">Type: ${esc(g.type)} | Status: ${esc(g.status)}</p><pre>${esc(JSON.stringify(g.data, null, 2))}</pre></div>`
      ).join('')
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(notebook.title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; background: #0f0f1a; color: #e0e0e0; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
  h2 { color: #7c7cff; margin-top: 2rem; }
  .card { background: #1a1a2e; border: 1px solid #2a2a3e; border-radius: 8px; padding: 1rem; margin: 0.75rem 0; }
  .card h3 { margin-top: 0; color: #c0c0ff; }
  .card.assistant { border-left: 3px solid #7c7cff; }
  .card.user { border-left: 3px solid #4caf50; }
  .meta { font-size: 0.8rem; color: #888; }
  .guide { font-style: italic; color: #aaa; }
  pre { white-space: pre-wrap; word-break: break-word; background: #12121e; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; overflow: auto; }
  .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #333; font-size: 0.8rem; color: #666; }
</style>
</head>
<body>
<h1>${esc(notebook.emoji)} ${esc(notebook.title)}</h1>
${notebook.description ? `<p>${esc(notebook.description)}</p>` : ''}
${sourcesHtml}
${notesHtml}
${chatHtml}
${generatedHtml}
<div class="footer">Exported from DeepNote AI on ${new Date().toLocaleString()}</div>
</body>
</html>`
}
