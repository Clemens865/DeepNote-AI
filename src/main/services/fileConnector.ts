/**
 * File Connector — scans user-configured folders for indexable documents.
 * Includes document types, excludes code files.
 */

import { readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

export interface ScannedFile {
  path: string
  name: string
  ext: string
  sizeBytes: number
  mtimeMs: number
}

const INCLUDED_EXTENSIONS = new Set([
  '.md', '.txt', '.docx', '.pdf', '.xlsx', '.csv', '.pptx', '.rtf', '.pages', '.doc',
])

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'target', 'build', 'dist', '.next', '__pycache__',
  '.venv', 'venv', '.cache', '.DS_Store', '.Trash',
])

/**
 * Recursively scan a folder for indexable document files.
 */
export function scanFolder(folderPath: string): ScannedFile[] {
  const results: ScannedFile[] = []
  scanRecursive(folderPath, results)
  return results
}

function scanRecursive(dir: string, results: ScannedFile[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return // Permission denied or doesn't exist
  }

  for (const entry of entries) {
    if (entry.startsWith('.') && entry !== '.') continue // Skip hidden files/dirs

    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      if (!EXCLUDED_DIRS.has(basename(fullPath))) {
        scanRecursive(fullPath, results)
      }
    } else if (stat.isFile()) {
      const ext = extname(entry).toLowerCase()
      if (INCLUDED_EXTENSIONS.has(ext)) {
        results.push({
          path: fullPath,
          name: entry,
          ext,
          sizeBytes: stat.size,
          mtimeMs: stat.mtimeMs,
        })
      }
    }
  }
}

/**
 * Get the list of included file extensions (for UI display).
 */
export function getIncludedExtensions(): string[] {
  return Array.from(INCLUDED_EXTENSIONS).map((e) => e.slice(1).toUpperCase())
}
