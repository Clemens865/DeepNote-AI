import { ipcMain, dialog, BrowserWindow } from 'electron'
import { GoogleGenAI } from '@google/genai'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { configService } from '../services/config'
import { resetEmbeddingsClient } from '../services/embeddings'
import { resetAiClient } from '../services/ai'

export function registerConfigHandlers() {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_API_KEY, async () => {
    return configService.getApiKey()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET_API_KEY, async (_event, key: string) => {
    configService.setApiKey(key)
    // Reset cached clients so they pick up the new key
    resetEmbeddingsClient()
    resetAiClient()
  })

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_TEST_API_KEY,
    async (_event, key: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const ai = new GoogleGenAI({ apiKey: key })
        await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: 'Say "ok"' }] }],
        })
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_FILE,
    async (_event, args: { filters: { name: string; extensions: string[] }[] }) => {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) return null
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: args.filters,
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )
}
