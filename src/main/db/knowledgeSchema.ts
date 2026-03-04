import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core'

export const knowledge = sqliteTable('knowledge', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  embedding: blob('embedding', { mode: 'buffer' }),
  embeddingDim: integer('embedding_dim').notNull().default(768),
  type: text('type', { enum: ['document', 'note', 'manual', 'clipboard', 'chat'] }).notNull().default('document'),
  importance: real('importance').notNull().default(0.5),
  sourcePath: text('source_path'),
  sourceTitle: text('source_title'),
  contentHash: text('content_hash').notNull(),
  tags: text('tags', { mode: 'json' }).notNull().default('[]'),
  clusterId: text('cluster_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const knowledgeFolders = sqliteTable('knowledge_folders', {
  id: text('id').primaryKey(),
  path: text('path').notNull(),
  fileCount: integer('file_count').notNull().default(0),
  lastScanAt: integer('last_scan_at'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
})

