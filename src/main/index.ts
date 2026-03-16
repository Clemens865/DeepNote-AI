import { app, shell, BrowserWindow, net, protocol } from 'electron'
import { join, extname } from 'path'
import { pathToFileURL } from 'url'
import { createReadStream, statSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { databaseService } from './services/database'
import { vectorStoreService } from './services/vectorStore'
import { registerNotebookHandlers } from './ipc/notebooks'
import { registerSourceHandlers } from './ipc/sources'
import { registerNoteHandlers } from './ipc/notes'
import { registerChatHandlers } from './ipc/chat'
import { registerStudioHandlers } from './ipc/studio'
import { registerConfigHandlers } from './ipc/config'
import { registerResearchHandlers } from './ipc/research'
import { registerWorkspaceHandlers } from './ipc/workspace'
import { registerSearchHandlers } from './ipc/search'
import { registerMemoryHandlers } from './ipc/memory'
import { registerClipboardHandlers } from './ipc/clipboard'
import { registerVoiceHandlers } from './ipc/voice'
import { registerKnowledgeHandlers } from './ipc/knowledge'
import { trayService } from './services/tray'
import { fileWatcherService } from './services/fileWatcher'
import { deepnoteApiServer } from './services/deepnoteApi'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f1f5f9',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// Register custom protocol for serving local files (slides, audio, etc.)
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } },
])

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.deepnote.ai')

  // Handle local-file:// protocol — serves files from userData directory
  // Supports Range requests for video/audio streaming
  const MIME_TYPES: Record<string, string> = {
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.json': 'application/json',
  }

  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    const userDataPath = app.getPath('userData')
    // Security: only serve files within userData
    if (!filePath.startsWith(userDataPath)) {
      return new Response('Forbidden', { status: 403 })
    }

    const ext = extname(filePath).toLowerCase()
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
    const isMedia = mimeType.startsWith('video/') || mimeType.startsWith('audio/')

    // For media files, handle Range requests for proper streaming/seeking
    if (isMedia) {
      try {
        const stat = statSync(filePath)
        const fileSize = stat.size
        const rangeHeader = request.headers.get('Range')

        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
          if (match) {
            const start = parseInt(match[1], 10)
            const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
            const chunkSize = end - start + 1
            const stream = createReadStream(filePath, { start, end })

            return new Response(stream as unknown as ReadableStream, {
              status: 206,
              headers: {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': String(chunkSize),
                'Content-Type': mimeType,
              },
            })
          }
        }

        // No Range header — return full file with Accept-Ranges
        const stream = createReadStream(filePath)
        return new Response(stream as unknown as ReadableStream, {
          status: 200,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Length': String(fileSize),
            'Content-Type': mimeType,
          },
        })
      } catch {
        return new Response('Not Found', { status: 404 })
      }
    }

    // For non-media files, use net.fetch (images, etc.)
    return net.fetch(pathToFileURL(filePath).toString())
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize services
  databaseService.init()
  vectorStoreService.init()

  // Register IPC handlers
  registerNotebookHandlers()
  registerSourceHandlers()
  registerNoteHandlers()
  registerChatHandlers()
  registerStudioHandlers()
  registerConfigHandlers()
  registerResearchHandlers()
  registerWorkspaceHandlers()
  registerSearchHandlers()
  registerMemoryHandlers()
  registerClipboardHandlers()
  registerVoiceHandlers()
  registerKnowledgeHandlers()

  // Start DeepNote REST API server for bidirectional integration
  deepnoteApiServer.start()

  console.log('[Main] Knowledge store initialized')

  const appWindow = createWindow()

  // Initialize tray after window is created
  trayService.init(appWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  deepnoteApiServer.stop()
  trayService.destroy()
  fileWatcherService.stopAll()
  databaseService.close()
  vectorStoreService.close()
})
