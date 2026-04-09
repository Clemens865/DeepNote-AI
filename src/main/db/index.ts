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

    CREATE TABLE IF NOT EXISTS user_memory (
      id TEXT PRIMARY KEY,
      notebook_id TEXT REFERENCES notebooks(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence REAL DEFAULT 0.5,
      last_used_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

  // Migration: add metadata column to chat_messages
  const chatCols = sqlite.pragma('table_info(chat_messages)') as { name: string }[]
  if (!chatCols.some((c) => c.name === 'metadata')) {
    sqlite.exec('ALTER TABLE chat_messages ADD COLUMN metadata TEXT')
  }

  // Migration: add tags column to notes
  const noteCols = sqlite.pragma('table_info(notes)') as { name: string }[]
  if (!noteCols.some((c) => c.name === 'tags')) {
    sqlite.exec("ALTER TABLE notes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
  }

  // Note Folders table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS note_folders (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      parent_id TEXT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  // Migration: add folder_id to notes
  if (!noteCols.some((c) => c.name === 'folder_id')) {
    sqlite.exec('ALTER TABLE notes ADD COLUMN folder_id TEXT REFERENCES note_folders(id) ON DELETE SET NULL')
  }

  // Knowledge Store tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      embedding BLOB,
      embedding_dim INTEGER NOT NULL DEFAULT 768,
      type TEXT NOT NULL DEFAULT 'document',
      importance REAL NOT NULL DEFAULT 0.5,
      source_path TEXT,
      source_title TEXT,
      content_hash TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      cluster_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_folders (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      file_count INTEGER NOT NULL DEFAULT 0,
      last_scan_at INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

  `)

  // Wiki Pages & Wiki Log tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS wiki_pages (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      page_type TEXT NOT NULL,
      source_ids TEXT NOT NULL DEFAULT '[]',
      coverage TEXT NOT NULL DEFAULT 'low',
      confidence REAL NOT NULL DEFAULT 0.5,
      related_pages TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wiki_log (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      source_id TEXT,
      pages_affected TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
  `)

  // Note Templates table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS note_templates (
      id TEXT PRIMARY KEY,
      notebook_id TEXT REFERENCES notebooks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      is_global INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  // Migration: add is_daily_note to notes
  const noteColsDaily = sqlite.pragma('table_info(notes)') as { name: string }[]
  if (!noteColsDaily.some((c) => c.name === 'is_daily_note')) {
    sqlite.exec('ALTER TABLE notes ADD COLUMN is_daily_note INTEGER NOT NULL DEFAULT 0')
  }

  // Indexes for frequently queried foreign keys
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_sources_notebook_id ON sources(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_source_id ON chunks(source_id);
    CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON notes(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_notebook_id ON chat_messages(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_generated_content_notebook_id ON generated_content(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_user_memory_notebook_id ON user_memory(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_files_notebook_id ON workspace_files(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_content_hash ON knowledge(content_hash);
    CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type);
    CREATE INDEX IF NOT EXISTS idx_knowledge_cluster_id ON knowledge(cluster_id);
    CREATE INDEX IF NOT EXISTS idx_note_folders_notebook_id ON note_folders(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
    CREATE INDEX IF NOT EXISTS idx_wiki_pages_notebook_id ON wiki_pages(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_wiki_log_notebook_id ON wiki_log(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_note_templates_notebook_id ON note_templates(notebook_id);
  `)

  // Canvas table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS canvases (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled Canvas',
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_canvases_notebook_id ON canvases(notebook_id);
  `)

  // Note Tasks table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS note_tasks (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      priority TEXT,
      line_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_note_tasks_notebook_id ON note_tasks(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_note_tasks_note_id ON note_tasks(note_id);
  `)

  // FTS5 full-text search for notes
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(title, content, content=notes, content_rowid=rowid);

    CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;
  `)

  // Populate FTS index from existing data
  sqlite.exec(`INSERT OR IGNORE INTO notes_fts(notes_fts) VALUES('rebuild')`)
}

export function getSqlite() {
  return sqlite
}

export function closeDatabase() {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
  }
}

export { schema }
