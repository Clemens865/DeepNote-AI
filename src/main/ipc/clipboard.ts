import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { trayService } from '../services/tray'
import { ingestSource } from '../services/sourceIngestion'
import { deepbrainService } from '../services/deepbrain'
import { configService } from '../services/config'

export function registerClipboardHandlers() {
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY, async () => {
    // Merge local tray history with DeepBrain clipboard history (if enabled)
    const localHistory = trayService.getHistory()
    if (configService.getAll().deepbrainEnabled !== false) {
      try {
        const sbClipboard = await deepbrainService.getClipboardHistory(10)
        if (sbClipboard.length > 0) {
          const sbTexts = sbClipboard.map((c) => c.content)
          // Merge: local first, then DeepBrain entries not already in local
          const merged = [...localHistory]
          for (const text of sbTexts) {
            if (!merged.includes(text)) merged.push(text)
          }
          return merged.slice(0, 20)
        }
      } catch {
        // DeepBrain offline
      }
    }
    return localHistory
  })

  ipcMain.handle(
    IPC_CHANNELS.CLIPBOARD_ADD_TO_NOTEBOOK,
    async (_event, args: { notebookId: string; text: string; title?: string }) => {
      const title = args.title || `Clipboard - ${new Date().toLocaleString()}`

      // Use the standard source ingestion pipeline (creates source + chunks + embeddings)
      const source = await ingestSource({
        notebookId: args.notebookId,
        type: 'paste',
        content: args.text,
        title,
      })

      return source
    }
  )
}
