import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { superbrainService } from '../services/superbrain'

export function registerSuperBrainHandlers() {
  ipcMain.handle(IPC_CHANNELS.SUPERBRAIN_STATUS, async () => {
    return superbrainService.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.SUPERBRAIN_RECALL, async (_event, args: { query: string; limit?: number }) => {
    return superbrainService.recall(args.query, args.limit)
  })

  ipcMain.handle(IPC_CHANNELS.SUPERBRAIN_SEARCH, async (_event, args: { query: string; limit?: number }) => {
    return superbrainService.searchFiles(args.query, args.limit)
  })

  ipcMain.handle(IPC_CHANNELS.SUPERBRAIN_CLIPBOARD, async (_event, args?: { limit?: number }) => {
    return superbrainService.getClipboardHistory(args?.limit)
  })

  ipcMain.handle(
    IPC_CHANNELS.SUPERBRAIN_REMEMBER,
    async (_event, args: { content: string; memoryType?: string; importance?: number }) => {
      return superbrainService.remember(
        args.content,
        (args.memoryType as import('../services/superbrain').MemoryType) || 'semantic',
        args.importance
      )
    }
  )

  ipcMain.handle(IPC_CHANNELS.SUPERBRAIN_THINK, async (_event, args: { input: string }) => {
    return superbrainService.think(args.input)
  })

  ipcMain.handle(
    IPC_CHANNELS.SUPERBRAIN_CONFIGURE,
    async (_event, args: { port?: number; token?: string | null }) => {
      if (args.port) superbrainService.setPort(args.port)
      if (args.token !== undefined) superbrainService.setApiToken(args.token)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DEEPNOTE_API_STATUS, async () => {
    const { deepnoteApiServer } = await import('../services/deepnoteApi')
    return {
      port: deepnoteApiServer.getPort(),
    }
  })
}
