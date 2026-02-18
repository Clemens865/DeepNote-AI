import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { trayService } from '../services/tray'
import { ingestSource } from '../services/sourceIngestion'
import { superbrainService } from '../services/superbrain'

export function registerClipboardHandlers() {
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY, async () => {
    // Merge local tray history with SuperBrain clipboard history
    const localHistory = trayService.getHistory()
    try {
      const sbClipboard = await superbrainService.getClipboardHistory(10)
      if (sbClipboard.length > 0) {
        const sbTexts = sbClipboard.map((c) => c.content)
        // Merge: local first, then SuperBrain entries not already in local
        const merged = [...localHistory]
        for (const text of sbTexts) {
          if (!merged.includes(text)) merged.push(text)
        }
        return merged.slice(0, 20)
      }
    } catch {
      // SuperBrain offline
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
