import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const notebooks = sqliteTable('notebooks', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default('Untitled notebook'),
  emoji: text('emoji').notNull().default('📓'),
  description: text('description').notNull().default(''),
  chatMode: text('chat_mode', { enum: ['auto', 'custom'] }).notNull().default('auto'),
  responseLength: text('response_length', { enum: ['short', 'medium', 'long'] }).notNull().default('medium'),
  workspaceRootPath: text('workspace_root_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  notebookId: text('notebook_id').notNull().references(() => notebooks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  filename: text('filename'),
  type: text('type', { enum: ['pdf', 'docx', 'txt', 'md', 'url', 'youtube', 'paste', 'audio'] }).notNull(),
  content: text('content').notNull().default(''),
  rawFilePath: text('raw_file_path'),
  isSelected: integer('is_selected', { mode: 'boolean' }).notNull().default(true),
  sourceGuide: text('source_guide'),
  createdAt: text('created_at').notNull(),
})

export const chunks = sqliteTable('chunks', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  pageNumber: integer('page_number'),
  chunkIndex: integer('chunk_index').notNull(),
  tokenCount: integer('token_count').notNull().default(0),
  createdAt: text('created_at').notNull(),
})

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  notebookId: text('notebook_id').notNull().references(() => notebooks.id, { onDelete: 'cascade' }),
  sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
  title: text('title').notNull().default('Untitled note'),
  content: text('content').notNull().default(''),
  isConvertedToSource: integer('is_converted_to_source', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  notebookId: text('notebook_id').notNull().references(() => notebooks.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  citations: text('citations', { mode: 'json' }).notNull().default('[]'),
  createdAt: text('created_at').notNull(),
})

export const generatedContent = sqliteTable('generated_content', {
  id: text('id').primaryKey(),
  notebookId: text('notebook_id').notNull().references(() => notebooks.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['audio', 'video', 'slides', 'image-slides', 'quiz', 'flashcard', 'mindmap', 'infographic', 'datatable', 'report'],
  }).notNull(),
  title: text('title').notNull(),
  data: text('data', { mode: 'json' }).notNull().default('{}'),
  sourceIds: text('source_ids', { mode: 'json' }).notNull().default('[]'),
  status: text('status', { enum: ['pending', 'generating', 'completed', 'failed'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull(),
})

export const workspaceFiles = sqliteTable('workspace_files', {
  id: text('id').primaryKey(),
  notebookId: text('notebook_id').notNull().references(() => notebooks.id, { onDelete: 'cascade' }),
  relativePath: text('relative_path').notNull(),
  fileSize: integer('file_size').notNull().default(0),
  mtimeMs: integer('mtime_ms').notNull().default(0),
  contentHash: text('content_hash'),
  sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['unindexed', 'indexed', 'stale', 'error'] }).notNull().default('unindexed'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
