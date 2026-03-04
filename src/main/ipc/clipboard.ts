import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { trayService } from '../services/tray'
import { ingestSource } from '../services/sourceIngestion'

export function registerClipboardHandlers() {
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY, async () => {
    return trayService.getHistory()
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
