import { Tray, Menu, globalShortcut, clipboard, BrowserWindow, nativeImage, app } from 'electron'
import { join } from 'path'
import { superbrainService } from './superbrain'
import { getDatabase, schema } from '../db'

const MAX_HISTORY = 10
const CLIP_PREVIEW_LENGTH = 60

class TrayService {
  private tray: Tray | null = null
  private clipboardHistory: string[] = []
  private mainWindow: BrowserWindow | null = null

  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow

    // Create tray icon — use a small version of the app icon
    const iconPath = join(__dirname, '../../resources/icon.png')
    let trayIcon: Electron.NativeImage
    try {
      trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 })
      trayIcon.setTemplateImage(true)
    } catch {
      // Fallback: create a simple colored circle
      trayIcon = nativeImage.createEmpty()
    }

    this.tray = new Tray(trayIcon)
    this.tray.setToolTip('DeepNote AI')
    this.updateMenu()

    // Register global shortcut: Cmd+Shift+N (Mac) / Ctrl+Shift+N (Windows/Linux)
    const accelerator = process.platform === 'darwin' ? 'CommandOrControl+Shift+N' : 'Control+Shift+N'
    try {
      globalShortcut.register(accelerator, () => {
        this.captureClipboard()
      })
    } catch (err) {
      console.warn('[Tray] Failed to register global shortcut:', err)
    }
  }

  captureClipboard(): void {
    const text = clipboard.readText().trim()
    if (!text) return

    // Avoid duplicates at the top
    if (this.clipboardHistory[0] === text) return

    // Remove if already exists elsewhere in history
    this.clipboardHistory = this.clipboardHistory.filter((h) => h !== text)

    // Add to front
    this.clipboardHistory.unshift(text)

    // Trim to max
    if (this.clipboardHistory.length > MAX_HISTORY) {
      this.clipboardHistory = this.clipboardHistory.slice(0, MAX_HISTORY)
    }

    // Broadcast to renderer
    this.broadcastToWindows('clipboard:captured', { text })

    // Fire-and-forget: store in SuperBrain as working memory
    superbrainService.remember(
      `[Clipboard Capture] ${text.slice(0, 500)}`,
      'working',
      0.3
    ).catch(() => { /* SuperBrain offline */ })

    // Update tray menu
    this.updateMenu()
  }

  private broadcastToWindows(channel: string, data: unknown): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(channel, data)
    })
  }

  private updateMenu(): void {
    if (!this.tray) return

    // Get notebooks for "Add to Notebook" submenu
    let notebookItems: Electron.MenuItemConstructorOptions[] = []
    try {
      const db = getDatabase()
      const notebooks = db.select().from(schema.notebooks).all()
      notebookItems = notebooks.map((nb) => ({
        label: `${nb.emoji || ''} ${nb.title}`.trim(),
        click: () => {
          // Broadcast to renderer to add clipboard to this notebook
          const text = clipboard.readText().trim()
          if (text) {
            this.broadcastToWindows('clipboard:add-to-notebook', {
              notebookId: nb.id,
              text,
              title: `Clipboard - ${new Date().toLocaleString()}`,
            })
            this.mainWindow?.show()
            this.mainWindow?.focus()
          }
        },
      }))
    } catch {
      // DB not ready yet
    }

    const historyItems: Electron.MenuItemConstructorOptions[] = this.clipboardHistory.map(
      (text, idx) => ({
        label: `${idx + 1}. ${text.slice(0, CLIP_PREVIEW_LENGTH)}${text.length > CLIP_PREVIEW_LENGTH ? '...' : ''}`,
        click: () => {
          // Copy to clipboard and bring window to front
          clipboard.writeText(text)
          this.mainWindow?.show()
          this.mainWindow?.focus()
        },
      })
    )

    const template: Electron.MenuItemConstructorOptions[] = [
      { label: 'DeepNote AI', enabled: false },
      { type: 'separator' },
      {
        label: 'Capture Clipboard (⌘⇧N)',
        click: () => this.captureClipboard(),
      },
      // Add to Notebook submenu
      ...(notebookItems.length > 0
        ? [{
            label: 'Add Clipboard to Notebook',
            submenu: notebookItems,
          } as Electron.MenuItemConstructorOptions]
        : []),
      { type: 'separator' },
      ...(historyItems.length > 0
        ? [
            { label: 'Recent Captures', enabled: false } as Electron.MenuItemConstructorOptions,
            ...historyItems,
            { type: 'separator' as const } as Electron.MenuItemConstructorOptions,
          ]
        : [{ label: 'No captures yet', enabled: false } as Electron.MenuItemConstructorOptions, { type: 'separator' as const } as Electron.MenuItemConstructorOptions]),
      {
        label: 'Clear History',
        click: () => {
          this.clipboardHistory = []
          this.updateMenu()
        },
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => {
          this.mainWindow?.show()
          this.mainWindow?.focus()
        },
      },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]

    const contextMenu = Menu.buildFromTemplate(template)
    this.tray.setContextMenu(contextMenu)
  }

  getHistory(): string[] {
    return [...this.clipboardHistory]
  }

  destroy(): void {
    globalShortcut.unregisterAll()
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

export const trayService = new TrayService()
