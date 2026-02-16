import { ipcMain } from 'electron'
import { memoryService } from '../services/memory'

export function registerMemoryHandlers() {
  ipcMain.handle('memory:list', async (_event, notebookId?: string | null) => {
    return memoryService.list(notebookId)
  })

  ipcMain.handle('memory:delete', async (_event, id: string) => {
    await memoryService.delete(id)
  })

  ipcMain.handle('memory:clear', async (_event, notebookId?: string | null) => {
    await memoryService.clear(notebookId)
  })
}
