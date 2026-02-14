import chokidar from 'chokidar'
import type { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'

interface WatcherEntry {
  watcher: FSWatcher
  debounceTimer: ReturnType<typeof setTimeout> | null
}

function broadcastToWindows(channel: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, data)
  })
}

class FileWatcherService {
  private watchers = new Map<string, WatcherEntry>()

  start(notebookId: string, rootPath: string, syncFn: (notebookId: string) => Promise<void>) {
    // Stop any existing watcher for this notebook
    this.stop(notebookId)

    const watcher = chokidar.watch(rootPath, {
      ignored: /node_modules|\.git|\.DS_Store|__pycache__|\.venv|dist|out|\.next/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500 },
    })

    const entry: WatcherEntry = { watcher, debounceTimer: null }

    const debouncedSync = () => {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
      entry.debounceTimer = setTimeout(async () => {
        try {
          broadcastToWindows('workspace:auto-sync', {
            notebookId,
            status: 'syncing',
            message: 'Auto-detecting file changes...',
          })

          await syncFn(notebookId)

          broadcastToWindows('workspace:auto-sync', {
            notebookId,
            status: 'complete',
            message: 'Files synced',
          })
        } catch (err) {
          console.warn('[FileWatcher] Auto-sync failed:', err)
          broadcastToWindows('workspace:auto-sync', {
            notebookId,
            status: 'error',
            message: err instanceof Error ? err.message : 'Sync failed',
          })
        }
      }, 2000)
    }

    watcher.on('change', debouncedSync)
    watcher.on('add', debouncedSync)
    watcher.on('unlink', debouncedSync)

    this.watchers.set(notebookId, entry)
    console.log(`[FileWatcher] Started watching: ${rootPath} for notebook ${notebookId}`)
  }

  stop(notebookId: string) {
    const entry = this.watchers.get(notebookId)
    if (entry) {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
      entry.watcher.close()
      this.watchers.delete(notebookId)
      console.log(`[FileWatcher] Stopped watching notebook ${notebookId}`)
    }
  }

  stopAll() {
    for (const [notebookId] of this.watchers) {
      this.stop(notebookId)
    }
  }

  isWatching(notebookId: string): boolean {
    return this.watchers.has(notebookId)
  }
}

export const fileWatcherService = new FileWatcherService()
