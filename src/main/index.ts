import { app, shell, BrowserWindow, net, protocol } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
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

function createWindow(): void {
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
}

// Register custom protocol for serving local files (slides, audio, etc.)
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } },
])

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.deepnote.ai')

  // Handle local-file:// protocol — serves files from userData directory
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    const userDataPath = app.getPath('userData')
    // Security: only serve files within userData
    if (!filePath.startsWith(userDataPath)) {
      return new Response('Forbidden', { status: 403 })
    }
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

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  databaseService.close()
  vectorStoreService.close()
})
