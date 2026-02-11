import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let db: ReturnType<typeof drizzle> | null = null
let sqlite: Database.Database | null = null

export function getDatabase() {
  if (db) return db

  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'deepnote-ai.db')

  sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  db = drizzle(sqlite, { schema })

  initializeDatabase()

  return db
}

function initializeDatabase() {
  if (!sqlite) return

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled notebook',
      emoji TEXT NOT NULL DEFAULT '📓',
      description TEXT NOT NULL DEFAULT '',
      chat_mode TEXT NOT NULL DEFAULT 'auto',
      response_length TEXT NOT NULL DEFAULT 'medium',
      workspace_root_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      filename TEXT,
      type TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      raw_file_path TEXT,
      is_selected INTEGER NOT NULL DEFAULT 1,
      source_guide TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      page_number INTEGER,
      chunk_index INTEGER NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
      title TEXT NOT NULL DEFAULT 'Untitled note',
      content TEXT NOT NULL DEFAULT '',
      is_converted_to_source INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generated_content (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      source_ids TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_files (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      relative_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mtime_ms INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT,
      source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'unindexed',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(notebook_id, relative_path)
    );
  `)

  // Migration: add workspace_root_path to existing notebooks table
  const columns = sqlite.pragma('table_info(notebooks)') as { name: string }[]
  if (!columns.some((c) => c.name === 'workspace_root_path')) {
    sqlite.exec('ALTER TABLE notebooks ADD COLUMN workspace_root_path TEXT')
  }
}

export function closeDatabase() {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
  }
}

export { schema }
