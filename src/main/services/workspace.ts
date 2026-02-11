import { readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, statSync, existsSync } from 'fs'
import { join, resolve, relative, dirname, extname, basename, sep } from 'path'
import { randomUUID } from 'crypto'
import { eq, and } from 'drizzle-orm'
import ignore from 'ignore'
import { getDatabase, schema } from '../db'
import type { WorkspaceTreeNode, WorkspaceDiffResult, WorkspaceFile, WorkspaceFileStatus } from '../../shared/types'

// ------- Constants -------

const MAX_DEPTH = 10
const MAX_FILES = 10_000

const ALWAYS_IGNORE = [
  '.git',
  'node_modules',
  '.DS_Store',
  '.env',
  '.env.*',
  'Thumbs.db',
  '__pycache__',
  '.venv',
  'dist',
  'out',
  '.next',
]

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.scala', '.swift', '.c', '.cpp', '.h', '.hpp',
  '.md', '.markdown', '.txt', '.text', '.rst', '.org',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.xml', '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
  '.sql', '.graphql', '.gql',
  '.r', '.R', '.lua', '.pl', '.pm', '.ex', '.exs', '.erl', '.hrl',
  '.vue', '.svelte', '.astro',
  '.env.example', '.gitignore', '.dockerignore', '.editorconfig',
  '.csv', '.tsv', '.log',
])

const DOC_EXTENSIONS = new Set(['.pdf', '.docx'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.wma', '.webm'])

// ------- Path Security -------

export function validateAndResolve(rootPath: string, relativePath: string): string {
  if (!relativePath || relativePath.includes('\0')) {
    throw new Error('Invalid file path')
  }

  // Block absolute paths
  if (relativePath.startsWith('/') || relativePath.startsWith('\\') || /^[A-Z]:/i.test(relativePath)) {
    throw new Error('Absolute paths are not allowed')
  }

  // Block parent traversal
  const normalized = relativePath.split(/[/\\]/).filter(Boolean)
  if (normalized.some((part) => part === '..')) {
    throw new Error('Path traversal is not allowed')
  }

  const resolved = resolve(rootPath, ...normalized)

  // Final check: must start with the root
  if (!resolved.startsWith(resolve(rootPath) + sep) && resolved !== resolve(rootPath)) {
    throw new Error('Path escapes workspace root')
  }

  return resolved
}

// ------- File Type Classification -------

export function classifyFile(relativePath: string): {
  isText: boolean
  isIndexable: boolean
  sourceType: 'txt' | 'md' | 'pdf' | 'docx' | 'audio' | null
} {
  const ext = extname(relativePath).toLowerCase()
  const base = basename(relativePath).toLowerCase()

  // Special dotfiles without extension
  if (!ext && (base === '.gitignore' || base === '.dockerignore' || base === '.editorconfig')) {
    return { isText: true, isIndexable: true, sourceType: 'txt' }
  }

  if (TEXT_EXTENSIONS.has(ext)) {
    return { isText: true, isIndexable: true, sourceType: ext === '.md' || ext === '.markdown' ? 'md' : 'txt' }
  }
  if (DOC_EXTENSIONS.has(ext)) {
    return { isText: false, isIndexable: true, sourceType: ext as 'pdf' | 'docx' }
  }
  if (AUDIO_EXTENSIONS.has(ext)) {
    return { isText: false, isIndexable: true, sourceType: 'audio' }
  }

  return { isText: false, isIndexable: false, sourceType: null }
}

// ------- Directory Scanning -------

interface ScanEntry {
  relativePath: string
  fileSize: number
  mtimeMs: number
}

export function scanDirectory(rootPath: string): ScanEntry[] {
  const root = resolve(rootPath)
  if (!existsSync(root)) throw new Error(`Workspace root does not exist: ${rootPath}`)

  // Load .gitignore if present
  const ig = ignore().add(ALWAYS_IGNORE)
  const gitignorePath = join(root, '.gitignore')
  if (existsSync(gitignorePath)) {
    try {
      const content = readFileSync(gitignorePath, 'utf-8')
      ig.add(content)
    } catch { /* ignore read errors */ }
  }

  const entries: ScanEntry[] = []

  function walk(dir: string, depth: number) {
    if (depth > MAX_DEPTH || entries.length >= MAX_FILES) return

    let items: string[]
    try {
      items = readdirSync(dir)
    } catch {
      return
    }

    for (const name of items) {
      if (entries.length >= MAX_FILES) return

      const fullPath = join(dir, name)
      const relPath = relative(root, fullPath)

      // Check ignore patterns (use posix separators for ignore lib)
      const posixRel = relPath.split(sep).join('/')

      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        if (ig.ignores(posixRel + '/')) continue
        walk(fullPath, depth + 1)
      } else if (stat.isFile()) {
        if (ig.ignores(posixRel)) continue
        entries.push({
          relativePath: posixRel,
          fileSize: stat.size,
          mtimeMs: Math.floor(stat.mtimeMs),
        })
      }
    }
  }

  walk(root, 0)
  return entries
}

// ------- Tree Building -------

export function buildTree(entries: ScanEntry[], manifest: Map<string, WorkspaceFile>): WorkspaceTreeNode {
  const root: WorkspaceTreeNode = {
    name: '',
    relativePath: '',
    isDirectory: true,
    children: [],
  }

  for (const entry of entries) {
    const parts = entry.relativePath.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const partPath = parts.slice(0, i + 1).join('/')

      if (isLast) {
        // File node
        const classification = classifyFile(entry.relativePath)
        const wf = manifest.get(entry.relativePath)
        current.children!.push({
          name: part,
          relativePath: partPath,
          isDirectory: false,
          fileSize: entry.fileSize,
          mtimeMs: entry.mtimeMs,
          status: wf?.status as WorkspaceFileStatus | undefined,
          sourceId: wf?.sourceId,
          isIndexable: classification.isIndexable,
        })
      } else {
        // Directory node — find or create
        let child = current.children!.find((c) => c.isDirectory && c.name === part)
        if (!child) {
          child = { name: part, relativePath: partPath, isDirectory: true, children: [] }
          current.children!.push(child)
        }
        current = child
      }
    }
  }

  // Sort: directories first, then alphabetical
  function sortTree(node: WorkspaceTreeNode) {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
      node.children.forEach(sortTree)
    }
  }
  sortTree(root)

  return root
}

// ------- Diff Logic -------

export function computeDiff(
  scanned: ScanEntry[],
  manifest: Map<string, WorkspaceFile>
): WorkspaceDiffResult {
  const result: WorkspaceDiffResult = { added: [], modified: [], deleted: [], unchanged: 0 }
  const seenPaths = new Set<string>()

  for (const entry of scanned) {
    seenPaths.add(entry.relativePath)
    const existing = manifest.get(entry.relativePath)

    if (!existing) {
      result.added.push(entry.relativePath)
    } else if (existing.mtimeMs !== entry.mtimeMs || existing.fileSize !== entry.fileSize) {
      result.modified.push(entry.relativePath)
    } else {
      result.unchanged++
    }
  }

  for (const [path] of manifest) {
    if (!seenPaths.has(path)) {
      result.deleted.push(path)
    }
  }

  return result
}

// ------- Manifest DB Operations -------

export function getManifest(notebookId: string): Map<string, WorkspaceFile> {
  const db = getDatabase()
  const rows = db
    .select()
    .from(schema.workspaceFiles)
    .where(eq(schema.workspaceFiles.notebookId, notebookId))
    .all()

  const map = new Map<string, WorkspaceFile>()
  for (const row of rows) {
    map.set(row.relativePath, row as WorkspaceFile)
  }
  return map
}

export function applyDiff(
  notebookId: string,
  scanned: ScanEntry[],
  diff: WorkspaceDiffResult
): void {
  const db = getDatabase()
  const now = new Date().toISOString()
  const scanMap = new Map(scanned.map((e) => [e.relativePath, e]))

  // Insert new files
  for (const path of diff.added) {
    const entry = scanMap.get(path)!
    db.insert(schema.workspaceFiles).values({
      id: randomUUID(),
      notebookId,
      relativePath: path,
      fileSize: entry.fileSize,
      mtimeMs: entry.mtimeMs,
      contentHash: null,
      sourceId: null,
      status: 'unindexed',
      createdAt: now,
      updatedAt: now,
    }).run()
  }

  // Mark modified files as stale
  for (const path of diff.modified) {
    const entry = scanMap.get(path)!
    db.update(schema.workspaceFiles)
      .set({
        fileSize: entry.fileSize,
        mtimeMs: entry.mtimeMs,
        status: 'stale',
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.workspaceFiles.notebookId, notebookId),
          eq(schema.workspaceFiles.relativePath, path)
        )
      )
      .run()
  }

  // Delete removed files' manifest entries
  for (const path of diff.deleted) {
    db.delete(schema.workspaceFiles)
      .where(
        and(
          eq(schema.workspaceFiles.notebookId, notebookId),
          eq(schema.workspaceFiles.relativePath, path)
        )
      )
      .run()
  }
}

// ------- File CRUD -------

export function readWorkspaceFile(rootPath: string, relativePath: string): string {
  const absPath = validateAndResolve(rootPath, relativePath)
  return readFileSync(absPath, 'utf-8')
}

export function writeWorkspaceFile(rootPath: string, relativePath: string, content: string): void {
  const absPath = validateAndResolve(rootPath, relativePath)
  const dir = dirname(absPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(absPath, content, 'utf-8')
}

export function createWorkspaceFile(rootPath: string, relativePath: string, content?: string): void {
  const absPath = validateAndResolve(rootPath, relativePath)
  if (existsSync(absPath)) throw new Error('File already exists')
  const dir = dirname(absPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(absPath, content || '', 'utf-8')
}

export function deleteWorkspaceFile(rootPath: string, relativePath: string): void {
  const absPath = validateAndResolve(rootPath, relativePath)
  if (!existsSync(absPath)) return
  unlinkSync(absPath)
}

export function createWorkspaceDirectory(rootPath: string, relativePath: string): void {
  const absPath = validateAndResolve(rootPath, relativePath)
  mkdirSync(absPath, { recursive: true })
}
