/**
 * DeepBrain Daemon Manager
 *
 * Manages the lifecycle of the bundled DeepBrain.app sidecar.
 * When DeepNote launches, this service:
 *   1. Checks if DeepBrain is already running on :19519
 *   2. If not, spawns the bundled DeepBrain.app with --managed flag
 *   3. Waits for it to become healthy
 *   4. Stops it when DeepNote quits
 */

import { spawn, ChildProcess, execSync } from 'child_process'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { app } from 'electron'
import http from 'http'

const DEEPBRAIN_PORT = 19519
const HEALTH_CHECK_URL = `http://127.0.0.1:${DEEPBRAIN_PORT}/api/status`
const STARTUP_TIMEOUT_MS = 15_000
const HEALTH_POLL_MS = 500
const GRACEFUL_STOP_MS = 5_000

export type DaemonState = 'stopped' | 'starting' | 'running' | 'external' | 'error'

class DeepBrainDaemon {
  private process: ChildProcess | null = null
  private state: DaemonState = 'stopped'
  private pid: number | null = null
  private errorMessage: string | null = null

  /**
   * Ensure DeepBrain is running. Called once at DeepNote startup.
   * Returns true if DeepBrain is available.
   */
  async ensureRunning(): Promise<boolean> {
    // 1. Check if already running (external install or previous session)
    if (await this.healthCheck()) {
      this.state = 'external'
      console.log('[DeepBrainDaemon] External DeepBrain detected on port', DEEPBRAIN_PORT)
      return true
    }

    // 2. Find bundled DeepBrain.app
    const appPath = this.findBundledApp()
    if (!appPath) {
      console.warn('[DeepBrainDaemon] No bundled DeepBrain.app found — running without brain')
      this.state = 'stopped'
      return false
    }

    // 3. Launch it
    return this.launchBundled(appPath)
  }

  /**
   * Stop the managed DeepBrain process.
   * No-op if DeepBrain was already running externally.
   */
  async stop(): Promise<void> {
    if (this.state === 'external') {
      console.log('[DeepBrainDaemon] External DeepBrain — not stopping it')
      return
    }

    if (!this.process && !this.pid) {
      return
    }

    const targetPid = this.process?.pid || this.pid
    if (!targetPid) return

    console.log('[DeepBrainDaemon] Stopping managed DeepBrain (PID:', targetPid, ')...')

    try {
      // SIGTERM for graceful shutdown
      process.kill(targetPid, 'SIGTERM')

      // Wait for graceful exit
      const stopped = await this.waitForExit(targetPid, GRACEFUL_STOP_MS)
      if (!stopped) {
        console.warn('[DeepBrainDaemon] Graceful stop timed out, sending SIGKILL')
        try {
          process.kill(targetPid, 'SIGKILL')
        } catch {
          // Already dead
        }
      }
    } catch {
      // Process already exited
    }

    this.process = null
    this.pid = null
    this.state = 'stopped'
    console.log('[DeepBrainDaemon] DeepBrain stopped')
  }

  /** Whether we launched DeepBrain ourselves (vs. it was already running) */
  isManaged(): boolean {
    return this.state === 'running' || this.state === 'starting'
  }

  /** Current daemon state for UI display */
  getState(): { state: DaemonState; pid: number | null; error: string | null } {
    return {
      state: this.state,
      pid: this.pid,
      error: this.errorMessage,
    }
  }

  // --- Private ---

  private findBundledApp(): string | null {
    // In packaged app: resources are in process.resourcesPath
    // In dev: check a few common locations
    const candidates = [
      // Packaged app (electron-builder extraResources)
      join(process.resourcesPath || '', 'DeepBrain.app'),
      // Dev: sibling project
      join(__dirname, '../../../../resources/DeepBrain.app'),
      // Dev: relative to repo root
      join(app.getAppPath(), '../../resources/DeepBrain.app'),
    ]

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        console.log('[DeepBrainDaemon] Found bundled app at:', candidate)
        return candidate
      }
    }

    return null
  }

  private async launchBundled(appPath: string): Promise<boolean> {
    this.state = 'starting'
    this.errorMessage = null

    console.log('[DeepBrainDaemon] Launching bundled DeepBrain.app:', appPath)

    try {
      // Use macOS `open` command to launch .app bundle with --managed flag
      this.process = spawn('open', ['-a', appPath, '--args', '--managed'], {
        detached: true,
        stdio: 'ignore',
      })

      this.process.unref()

      // `open` exits immediately after launching; the actual DeepBrain PID
      // will be different. We'll discover it via the PID file or health check.
      this.process.on('error', (err) => {
        console.error('[DeepBrainDaemon] Failed to launch:', err)
        this.state = 'error'
        this.errorMessage = err.message
      })

      // Wait for health check to pass
      const healthy = await this.waitForHealthy(STARTUP_TIMEOUT_MS)
      if (healthy) {
        this.state = 'running'
        this.pid = this.readPidFile()
        console.log('[DeepBrainDaemon] DeepBrain is running (PID:', this.pid, ')')
        return true
      } else {
        this.state = 'error'
        this.errorMessage = 'Startup timed out after ' + (STARTUP_TIMEOUT_MS / 1000) + 's'
        console.error('[DeepBrainDaemon]', this.errorMessage)
        return false
      }
    } catch (err) {
      this.state = 'error'
      this.errorMessage = (err as Error).message
      console.error('[DeepBrainDaemon] Launch error:', err)
      return false
    }
  }

  private healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(HEALTH_CHECK_URL, { timeout: 3000 }, (res) => {
        // Any 2xx response means it's alive
        resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300)
        res.resume() // Consume response data
      })
      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  private async waitForHealthy(timeoutMs: number): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (await this.healthCheck()) {
        return true
      }
      await sleep(HEALTH_POLL_MS)
    }
    return false
  }

  private async waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        // Signal 0 checks if process exists without killing it
        process.kill(pid, 0)
        await sleep(200)
      } catch {
        return true // Process gone
      }
    }
    return false
  }

  private readPidFile(): number | null {
    try {
      const pidPath = join(
        process.env.HOME || '',
        'Library/Application Support/DeepBrain/.pid'
      )
      if (existsSync(pidPath)) {
        const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10)
        return isNaN(pid) ? null : pid
      }
    } catch {
      // Ignore
    }
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const deepbrainDaemon = new DeepBrainDaemon()
