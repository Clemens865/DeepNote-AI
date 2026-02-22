import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { memoryService } from '../services/memory'

export function registerMemoryHandlers() {
  ipcMain.handle(IPC_CHANNELS.MEMORY_LIST, async (_event, notebookId?: string | null) => {
    return memoryService.list(notebookId)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_DELETE, async (_event, id: string) => {
    await memoryService.delete(id)
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_CLEAR, async (_event, notebookId?: string | null) => {
    await memoryService.clear(notebookId)
  })
}
