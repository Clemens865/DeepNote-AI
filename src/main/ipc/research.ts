import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { aiService } from '../services/ai'

function broadcastToWindows(channel: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, data)
  })
}

export function registerResearchHandlers() {
  ipcMain.handle(
    IPC_CHANNELS.DEEP_RESEARCH_START,
    async (_event, args: { notebookId: string; query: string }) => {
      const db = getDatabase()
      const interactionId = randomUUID()

      // Get selected sources
      const sources = await db
        .select()
        .from(schema.sources)
        .where(eq(schema.sources.notebookId, args.notebookId))

      const selectedSources = sources.filter((s) => s.isSelected)
      if (selectedSources.length === 0) {
        throw new Error('No sources selected. Please select at least one source for deep research.')
      }

      const sourceTexts = selectedSources.map((s) => s.content)

      // Fire-and-forget the actual research
      aiService
        .deepResearch(args.query, sourceTexts, (status, thinking) => {
          broadcastToWindows('deep-research:progress', { status, thinking })
        })
        .then(async (result) => {
          // Save as assistant chat message
          const now = new Date().toISOString()
          const currentDb = getDatabase()
          await currentDb.insert(schema.chatMessages).values({
            id: randomUUID(),
            notebookId: args.notebookId,
            role: 'assistant',
            content: result,
            citations: JSON.stringify([]),
            createdAt: now,
          })

          broadcastToWindows('deep-research:complete', { success: true })
        })
        .catch((err) => {
          broadcastToWindows('deep-research:complete', {
            success: false,
            error: err instanceof Error ? err.message : 'Deep research failed',
          })
        })

      return { interactionId }
    }
  )
}
