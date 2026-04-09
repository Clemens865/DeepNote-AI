# DeepNote AI Notes System - Architecture Upgrade Sketch

## System Overview

```
+----------------------------------------------------------------------+
|                         ELECTRON 39 SHELL                            |
|----------------------------------------------------------------------|
|  RENDERER (React 19 + Tailwind v4)                                   |
|  +----------------------------------------------------------------+  |
|  |  App Shell (Zustand: appStore, notebookStore, workspaceStore)  |  |
|  |  +----------------------------+  +---------------------------+ |  |
|  |  | Notes Workspace            |  | Canvas / Graph Views      | |  |
|  |  | +-----------+ +----------+ |  | +----------+ +----------+ | |  |
|  |  | | Folder    | | Tiptap   | |  | | Canvas   | | Graph    | | |  |
|  |  | | Explorer  | | Editor   | |  | | (tldraw) | | (Cyto)   | | |  |
|  |  | +-----------+ +----------+ |  | +----------+ +----------+ | |  |
|  |  | +----------+ +-----------+ |  | +----------+ +----------+ | |  |
|  |  | | Quick    | | Command   | |  | | Wiki     | | Template | | |  |
|  |  | | Switcher | | Palette   | |  | | Viewer   | | Browser  | | |  |
|  |  | +----------+ +-----------+ |  | +----------+ +----------+ | |  |
|  |  +----------------------------+  +---------------------------+ |  |
|  +----------------------------------------------------------------+  |
|  | New Zustand Stores: noteTreeStore, canvasStore, graphStore,    |  |
|  |   wikiStore, searchStore, taskStore, templateStore             |  |
|  +----------------------------------------------------------------+  |
|----------------------------------------------------------------------|
|                     IPC BRIDGE (~195 channels)                       |
|----------------------------------------------------------------------|
|  MAIN PROCESS (Node.js)                                              |
|  +----------------------------------------------------------------+  |
|  | New IPC Handlers                                                | |
|  | folders.ts | canvas.ts | wiki.ts | tasks.ts | templates.ts     | |
|  +----------------------------------------------------------------+  |
|  +----------------------------------------------------------------+  |
|  | Services                                                        | |
|  | +------------------+ +------------------+ +-----------------+   | |
|  | | Search Service   | | Wiki Generator   | | Task Scheduler  |   | |
|  | | (FTS5 + Vector)  | | (AI Provider)    | | (cron-like)     |   | |
|  | +------------------+ +------------------+ +-----------------+   | |
|  +----------------------------------------------------------------+  |
|  +----------------------------------------------------------------+  |
|  | SQLite (better-sqlite3 + Drizzle ORM)                           | |
|  | Existing: notebooks, sources, chunks, notes, knowledge, ...     | |
|  | New: note_folders, note_links, canvases, canvas_nodes,          | |
|  |      wiki_pages, wiki_revisions, tasks, templates,              | |
|  |      notes_fts (FTS5 virtual table)                             | |
|  +----------------------------------------------------------------+  |
+----------------------------------------------------------------------+
```

## New Components

| Component | Purpose | Technology | Build/Buy |
|---|---|---|---|
| **Tiptap Note Editor** | Replace textarea with rich markdown editor; blocks, slash commands, embeds | `@tiptap/react` + `@tiptap/pm`, extensions: `StarterKit`, `Markdown`, `TaskList`, `Table`, `CodeBlockLowlight`, `Placeholder` | Buy (npm) + custom extensions |
| **Folder/File Explorer** | Tree view for note hierarchy; drag-drop reorder, nested folders | Custom React tree component with `@dnd-kit/sortable` | Build (renderer only) |
| **Quick Switcher** | Cmd+O fuzzy-find across all notes, wiki pages, canvases | Custom modal + `fuse.js` for client-side fuzzy matching | Build + Buy (`fuse.js`) |
| **Command Palette** | Cmd+K actions: create note, toggle view, run workflow, AI commands | Custom modal, registry pattern for commands | Build (renderer only) |
| **Graph Renderer** | Interactive node-link graph of note connections, backlinks, tags | `cytoscape.js` + `cytoscape-cola` layout | Buy (npm) |
| **Canvas Engine** | Freeform spatial canvas with notes, images, connectors, groups | `@tldraw/tldraw` embedded in iframe/component | Buy (npm) |
| **Wiki Engine** | AI-generated knowledge wiki from sources; versioned pages, TOC | Custom service (main process) + Tiptap viewer (renderer) | Build |
| **Search Service** | Unified full-text + semantic search across notes, wiki, sources | SQLite FTS5 virtual table + existing vector store | Build (extend existing) |
| **Task System** | Checkboxes in notes that sync to a task board; due dates, priorities | Custom Tiptap extension + Zustand store + DB table | Build |
| **Template Engine** | Reusable note templates (meeting notes, research, daily log) with variables | JSON schema templates + Tiptap content injection | Build |

## Key Technical Decisions

| # | Decision | Options Considered | Recommendation | Why |
|---|---|---|---|---|
| 1 | **Graph library** | D3.js, vis.js, Cytoscape.js, sigma.js | **Cytoscape.js** | Best API for graph-specific operations (BFS, shortest path, clustering). Cola layout handles dynamic note graphs well. Sigma.js is WebGL-perf but overkill for <10K nodes. D3 too low-level. |
| 2 | **Canvas engine** | tldraw, Excalidraw, custom SVG, ReactFlow | **tldraw** | Full-featured freeform canvas with built-in shapes, connectors, text. MIT-licensed. Embeds cleanly in React. Excalidraw lacks connector semantics. ReactFlow is node-graph only, not spatial. |
| 3 | **Wiki storage** | SQLite tables, markdown files on disk, hybrid | **SQLite tables** (wiki_pages + wiki_revisions) | Keeps everything in one DB, enables FTS5 indexing, transactional revisions. Markdown files would need a watcher + sync layer -- complexity for no gain in an Electron app. |
| 4 | **Search architecture** | FTS5 + existing vector store, new Tantivy/MeiliSearch, Lunr.js client-side | **FTS5 + existing vector store** | FTS5 is zero-dependency (built into SQLite), handles boolean/phrase queries. Combine with existing ONNX/Gemini vector store for semantic search. No new process to manage. |
| 5 | **Tiptap extensions** | All custom, all npm packages, hybrid | **Hybrid: npm StarterKit + custom for [[links]], #tags, /slash, task sync** | StarterKit covers 80% (bold, lists, code, headings). Custom extensions needed for wiki-link resolution (existing IPC), tag extraction, slash command menu, and task-to-DB sync. |
| 6 | **State management** | Extend existing Zustand stores, new stores per feature, Redux migration | **New Zustand stores per feature domain** | Keeps existing stores stable. Each new feature (noteTree, canvas, graph, wiki, search, tasks, templates) gets its own store. Cross-store communication via Zustand `subscribe`. No reason to migrate to Redux. |
| 7 | **Note content format** | Raw markdown (current), Tiptap JSON, HTML | **Tiptap JSON stored, markdown import/export** | Tiptap JSON preserves block structure for canvas embeds and task sync. Existing `notes.content` (text) stays as-is for backward compat; new `contentJson` column added. Migration: parse existing markdown to Tiptap JSON on first edit. |

## Schema Changes

```sql
-- Note folders (tree hierarchy)
CREATE TABLE note_folders (
  id            TEXT PRIMARY KEY,
  notebook_id   TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  parent_id     TEXT REFERENCES note_folders(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'Untitled',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  icon          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Extend notes table (new columns via ALTER TABLE)
ALTER TABLE notes ADD COLUMN folder_id TEXT REFERENCES note_folders(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN content_json TEXT;           -- Tiptap JSON document
ALTER TABLE notes ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN is_pinned INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN note_type TEXT DEFAULT 'note'; -- 'note' | 'daily' | 'template' | 'wiki'
ALTER TABLE notes ADD COLUMN icon TEXT;

-- Explicit link graph (extracted from content on save)
CREATE TABLE note_links (
  id            TEXT PRIMARY KEY,
  source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  link_type     TEXT NOT NULL DEFAULT 'wiki',  -- 'wiki' | 'embed' | 'reference'
  context       TEXT,                          -- surrounding text snippet
  created_at    TEXT NOT NULL,
  UNIQUE(source_note_id, target_note_id, link_type)
);

-- Canvas documents
CREATE TABLE canvases (
  id            TEXT PRIMARY KEY,
  notebook_id   TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled Canvas',
  tldraw_data   TEXT NOT NULL DEFAULT '{}',   -- tldraw document JSON
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Canvas-to-note links (which notes are embedded on a canvas)
CREATE TABLE canvas_nodes (
  id            TEXT PRIMARY KEY,
  canvas_id     TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  note_id       TEXT REFERENCES notes(id) ON DELETE SET NULL,
  node_type     TEXT NOT NULL DEFAULT 'note', -- 'note' | 'source' | 'text' | 'image'
  position_x    REAL NOT NULL DEFAULT 0,
  position_y    REAL NOT NULL DEFAULT 0,
  width         REAL NOT NULL DEFAULT 200,
  height        REAL NOT NULL DEFAULT 150,
  data          TEXT DEFAULT '{}'
);

-- Wiki pages (AI-generated knowledge articles)
CREATE TABLE wiki_pages (
  id            TEXT PRIMARY KEY,
  notebook_id   TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL,
  content_json  TEXT NOT NULL DEFAULT '{}',
  summary       TEXT,
  source_ids    TEXT DEFAULT '[]',             -- JSON array of source IDs used
  status        TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'generated' | 'reviewed'
  parent_id     TEXT REFERENCES wiki_pages(id) ON DELETE SET NULL,
  sort_order    INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE(notebook_id, slug)
);

-- Wiki revision history
CREATE TABLE wiki_revisions (
  id            TEXT PRIMARY KEY,
  wiki_page_id  TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  content_json  TEXT NOT NULL,
  change_summary TEXT,
  created_at    TEXT NOT NULL
);

-- Tasks extracted from note checkboxes
CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  notebook_id   TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  note_id       TEXT REFERENCES notes(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'todo', -- 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority      TEXT DEFAULT 'medium',        -- 'low' | 'medium' | 'high' | 'urgent'
  due_date      TEXT,
  tags          TEXT DEFAULT '[]',
  sort_order    INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Note templates
CREATE TABLE note_templates (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  content_json  TEXT NOT NULL,
  category      TEXT DEFAULT 'general',       -- 'general' | 'meeting' | 'research' | 'daily' | 'project'
  variables     TEXT DEFAULT '[]',            -- JSON: [{ name, type, default }]
  is_builtin    INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Full-text search (FTS5 virtual table)
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, content, tags,
  content='notes',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

-- FTS triggers for auto-sync
CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;

CREATE TRIGGER notes_fts_update AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content, tags)
  VALUES ('delete', old.rowid, old.title, old.content, old.tags);
  INSERT INTO notes_fts(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;

CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content, tags)
  VALUES ('delete', old.rowid, old.title, old.content, old.tags);
END;
```

## Data Flow

```
1. SOURCE INGESTION (existing)
   User uploads PDF/URL/paste
   -> src/main/ipc/sources.ts parses + chunks
   -> chunks table + vector embeddings (knowledge table)

2. WIKI GENERATION (new - Tier 6)
   User triggers "Generate Wiki" on notebook
   -> wiki.ts IPC handler reads selected sources + chunks
   -> getChatProvider() generates structured wiki content
   -> wiki_pages + wiki_revisions tables populated
   -> notes_fts indexed via triggers
   -> note_links extracted for cross-references

3. NOTE CREATION / EDITING (upgraded - Tier 1)
   User creates/edits note in Tiptap editor
   -> Tiptap onChange -> debounced IPC NOTES_UPDATE
   -> notes.content_json saved (Tiptap JSON)
   -> notes.content saved (plain text fallback)
   -> extractTags() runs (existing)
   -> extractLinks() runs (new) -> note_links table updated
   -> FTS5 triggers auto-update notes_fts
   -> Task extension syncs checkboxes -> tasks table

4. SEARCH INDEXING (upgraded - Tier 4+)
   On note/wiki save:
   -> FTS5 auto-indexed via triggers (instant)
   -> Vector embedding queued (async, existing pipeline)
   -> Combined search: FTS5 for keyword, vector for semantic
   -> Quick Switcher uses fuse.js on cached title list (client-side)

5. GRAPH BUILDING (new - Tier 3)
   On note_links table change:
   -> graph IPC handler queries note_links + notes
   -> Returns { nodes[], edges[] } (same shape as KNOWLEDGE_GRAPH)
   -> Cytoscape.js renders in graphStore
   -> Click node -> navigate to note

6. CANVAS SYNC (new - Tier 5)
   User places note on canvas:
   -> canvas_nodes record created
   -> tldraw state saved to canvases.tldraw_data
   -> Note edits propagate to canvas card via subscription
   -> Canvas position changes saved on tldraw onChange
```

## IPC Channel Plan

### Tier 1: Editor Upgrade (3 channels)

```
notes:getJson          - Get Tiptap JSON content for a note
notes:updateJson       - Save Tiptap JSON content
notes:extractLinks     - Force re-extract [[links]] from content -> note_links
```

### Tier 2: Organization (7 channels)

```
folders:list           - List note folders for a notebook (tree)
folders:create         - Create folder (with parentId for nesting)
folders:update         - Rename, reorder, move folder
folders:delete         - Delete folder (notes get folder_id=NULL)
notes:move             - Move note to folder
notes:reorder          - Update sort_order within folder
notes:pin              - Toggle pin status
```

### Tier 3: Graph (3 channels)

```
graph:noteLinks        - Get { nodes, edges } for note link graph
graph:noteNeighbors    - Get N-hop neighborhood for a note
graph:noteClusters     - Get auto-detected clusters (tag-based or link-based)
```

### Tier 4: Workflows / Tasks (6 channels)

```
tasks:list             - List tasks (filterable by notebook, status, due date)
tasks:create           - Create standalone task
tasks:update           - Update status, priority, due date
tasks:delete           - Delete task
tasks:syncFromNote     - Sync checkboxes from a note's Tiptap JSON
tasks:bulkUpdate       - Batch status update (mark multiple done)
```

### Tier 5: Canvas (5 channels)

```
canvas:list            - List canvases for a notebook
canvas:create          - Create new canvas
canvas:update          - Save tldraw document state
canvas:delete          - Delete canvas
canvas:nodes           - CRUD for canvas_nodes (note embeds)
```

### Tier 6: Knowledge Wiki (7 channels)

```
wiki:generate          - AI-generate wiki from notebook sources
wiki:list              - List wiki pages for a notebook
wiki:get               - Get single wiki page + revision history
wiki:update            - Edit wiki page content
wiki:delete            - Delete wiki page
wiki:revisions         - List revisions for a page
wiki:revert            - Revert to a specific revision
```

### Tier 7: AI-Native (4 channels)

```
templates:list         - List note templates (builtin + custom)
templates:create       - Create custom template
templates:delete       - Delete custom template
templates:instantiate  - Create note from template with variable substitution
```

### Cross-cutting (2 channels)

```
search:notes           - FTS5 + vector hybrid search across notes + wiki
commandPalette:actions - Get available actions for command palette context
```

**Total new channels: ~37 (168 existing + 37 = ~205)**

## Implementation Priority & Dependencies

```
Phase 1 (Foundation):  Tier 1 (Tiptap editor) + Tier 2 (folders)
                       Must land first -- everything else depends on Tiptap JSON format.
                       Migration: existing notes.content -> content_json on first open.

Phase 2 (Intelligence): Tier 3 (graph) + Tier 4 (tasks)
                        Graph uses note_links populated by Tier 1.
                        Tasks use Tiptap TaskList extension from Tier 1.

Phase 3 (Spatial):     Tier 5 (canvas)
                        Embeds Tiptap notes as cards. Needs stable note rendering.

Phase 4 (Knowledge):   Tier 6 (wiki) + Tier 7 (AI-native / templates)
                        Wiki generation leverages existing AI provider infra.
                        Templates are low-risk, can ship whenever.
```

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Tiptap bundle size (~200KB) | Already have ProseMirror via DraggableTextElement; shared dependency. Lazy-load editor. |
| tldraw bundle size (~1.5MB) | Load canvas view on-demand via React.lazy + Suspense. Not in critical path. |
| FTS5 migration on existing DBs | Run `CREATE VIRTUAL TABLE IF NOT EXISTS` + backfill trigger in Drizzle migration. |
| Tiptap JSON backward compat | Keep `notes.content` (plain text) always in sync. Old notes render via markdown-to-Tiptap parser on first edit. |
| note_links table scale | Index on (source_note_id) and (target_note_id). Most notebooks have <1K notes. |
| Canvas state conflicts | tldraw has its own undo/redo. Save full document JSON on debounced onChange (same as current notes pattern). |
