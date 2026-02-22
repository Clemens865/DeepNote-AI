import { execFile } from 'child_process'
import { homedir, platform } from 'os'
import { basename } from 'path'

export interface SpotlightResult {
  path: string
  name: string
  kind: string
}

/**
 * Search macOS Spotlight (mdfind) for files matching a query.
 * Returns [] on non-macOS or on error.
 */
export function spotlightSearch(query: string, limit = 10): Promise<SpotlightResult[]> {
  if (platform() !== 'darwin' || !query.trim()) return Promise.resolve([])

  return new Promise((resolve) => {
    const child = execFile(
      'mdfind',
      ['-name', query.trim(), '-onlyin', homedir()],
      { timeout: 2000, maxBuffer: 512 * 1024 },
      (err, stdout) => {
        if (err) return resolve([])
        const lines = stdout.trim().split('\n').filter(Boolean).slice(0, limit)
        resolve(
          lines.map((p) => {
            const ext = p.includes('.') ? p.split('.').pop() ?? '' : ''
            return { path: p, name: basename(p), kind: ext }
          })
        )
      }
    )
    // Safety: kill if timeout doesn't fire
    setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
    }, 2500)
  })
}
