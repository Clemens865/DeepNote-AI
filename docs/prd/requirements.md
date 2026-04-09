# DeepNote AI Notes System Upgrade: Obsidian-Class + Karpathy Knowledge Wiki

**Version:** 1.0
**Date:** 2026-04-06
**Status:** Draft
**Baseline:** Electron 39, React 19, Tailwind v4, SQLite/Drizzle, Tiptap (Studio only), vector store (`knowledge` table w/ embeddings), multi-provider AI (Gemini/Claude/OpenAI/Groq), IPC arch. Notes: plain `<textarea>`, `#tags` (extracted via `tagParser.ts`), `[[wiki links]]`, backlinks panel.

---

## Tier 1 -- Editor (FR-ED)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-ED-01 | Replace `<textarea>` in `NoteEditor.tsx` with Tiptap editor using `StarterKit` + custom extensions | Tiptap instance renders in note editor; existing note content loads without data loss |
| FR-ED-02 | Support three editing modes: Live Preview (default), Source (raw markdown), Reading (rendered, non-editable) | Mode toggle in toolbar; switching preserves cursor position within 5 lines |
| FR-ED-03 | Render callout blocks (`>[!type] title`) as styled admonitions for types: note, tip, warning, danger, info, abstract, todo, example, quote | Callout renders with distinct icon + color per type in Live Preview and Reading modes |
| FR-ED-04 | Render inline and block KaTeX math (`$...$` and `$$...$$`) | Renders LaTeX expressions; syntax errors show inline error message, not crash |
| FR-ED-05 | Render fenced Mermaid code blocks (` ```mermaid `) as diagrams inline | Reuse existing `mermaidSanitizer.ts`; diagrams render in Live Preview and Reading modes |
| FR-ED-06 | Syntax-highlighted fenced code blocks with language label and copy button | Supports 20+ languages via Shiki/Prism; copy button copies raw code to clipboard |
| FR-ED-07 | Note transclusion: `![[Note Title]]` embeds target note content inline (read-only) | Embedded content updates live when target note changes; max 3 levels of nesting |
| FR-ED-08 | Block references: `^block-id` suffix creates anchor; `[[Note#^block-id]]` links to specific block | Clicking block ref scrolls to target block; auto-generated IDs are 6-char alphanumeric |
| FR-ED-09 | Heading references: `[[Note#Heading]]` links to specific heading in target note | Clicking heading ref opens target note and scrolls to heading |
| FR-ED-10 | Comment syntax: `%%hidden text%%` renders in Source mode only, hidden in Live Preview and Reading | Comments persisted in content but never rendered visually in preview modes |
| FR-ED-11 | Frontmatter/properties panel: YAML frontmatter `---` block with typed fields (text, number, date, list, checkbox) | Panel UI above editor shows properties; changes sync to YAML block and vice versa |
| FR-ED-12 | Auto-save with debounce (current 500ms timer preserved) and dirty indicator in title bar | Unsaved indicator (dot) shows within 100ms of edit; save completes within 1s |
| FR-ED-13 | Formatting toolbar: bold, italic, strikethrough, headings 1-6, bullet/numbered list, checklist, link, image, code, blockquote, horizontal rule, table | All toolbar actions insert correct markdown syntax; keyboard shortcuts for each |
| FR-ED-14 | Slash command menu (`/`) for inserting blocks: callout, code, table, math, mermaid, embed, template | Menu appears within 100ms of `/` keystroke; filterable by typing |

## Tier 2 -- Organization (FR-ORG)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-ORG-01 | Folder hierarchy: notes can be organized into nested folders within a notebook | Drag-and-drop reordering; folders collapsible; folder path shown in breadcrumb |
| FR-ORG-02 | Quick Switcher (`Cmd+O`): fuzzy-search notes by title, alias, and path | Results appear within 100ms of keystroke; top 20 results shown; Enter opens note |
| FR-ORG-03 | Command Palette (`Cmd+P`): searchable list of all editor/app commands | Extends existing `CommandPalette.tsx`; lists 50+ commands; supports fuzzy matching |
| FR-ORG-04 | Full-text search with operators: `tag:#value`, `path:folder/`, `has:link`, `has:task`, `-exclude`, `"exact phrase"` | Search results in <200ms for 10K notes; highlights matched terms in context |
| FR-ORG-05 | Outline panel: collapsible heading-based TOC for current note | Updates in real-time as headings are added/removed; click scrolls to heading |
| FR-ORG-06 | Bookmarks: star/pin notes for quick access in a dedicated sidebar section | Toggle bookmark via context menu or shortcut; persisted across sessions |
| FR-ORG-07 | Recent notes: show last 20 opened notes in sidebar, ordered by access time | Updates on note open/focus; persisted across app restarts |
| FR-ORG-08 | Aliases: notes can have multiple alternative names that resolve via `[[alias]]` links | Aliases stored in frontmatter `aliases:` field; Quick Switcher searches aliases |
| FR-ORG-09 | Nested tags: `#parent/child/grandchild` with hierarchy in Tag Browser | `TagBrowser.tsx` renders as collapsible tree; clicking parent shows all descendants |
| FR-ORG-10 | Sort notes list by: title, created date, modified date, manual order | Sort preference persisted per folder; default is modified-date descending |

## Tier 3 -- Graph (FR-GR)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-GR-01 | Global force-directed graph: all notes as nodes, `[[links]]` as edges, rendered via D3/Canvas | Renders 5,000 nodes at 30fps; pan/zoom; click node opens note |
| FR-GR-02 | Local per-note graph: show 1-2 hop neighborhood of selected note | Opens in side panel; depth toggle (1 or 2 hops); highlights current note |
| FR-GR-03 | Unlinked mentions: detect note titles appearing as plain text in other notes | Listed below backlinks in `BacklinksPanel.tsx`; one-click to convert to `[[link]]` |
| FR-GR-04 | Link count badges: show incoming + outgoing link count on each note in list | Badge format: `3 in / 5 out`; updates on save |
| FR-GR-05 | Graph filters: toggle visibility by folder, tag, orphan status, link count range | Filter panel overlays graph; filters apply in <100ms |
| FR-GR-06 | Graph search: highlight and center on nodes matching a text query | Search box in graph toolbar; matching nodes pulse/glow; non-matches dim |
| FR-GR-07 | Node coloring: color nodes by folder, tag, or creation date gradient | Color legend shown; user selects coloring mode from dropdown |

## Tier 4 -- Workflows (FR-WF)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-WF-01 | Daily notes: auto-create note named `YYYY-MM-DD` with configurable template on first open of day | Keyboard shortcut (`Cmd+D`) opens today's note; creates if not exists |
| FR-WF-02 | Templates: define reusable note templates with variables `{{title}}`, `{{date}}`, `{{time}}`, `{{cursor}}` | Template picker on note creation; variables resolved at creation time |
| FR-WF-03 | Periodic notes: weekly (`YYYY-[W]WW`), monthly (`YYYY-MM`), quarterly, yearly with templates | Navigable via calendar widget; auto-created on first access |
| FR-WF-04 | Task checkboxes: `- [ ] task` / `- [x] done` with optional due date `[due:YYYY-MM-DD]` and priority `[p1]`-`[p3]` | Checkbox toggles in Live Preview; due dates parsed and displayed |
| FR-WF-05 | Task query blocks: ` ```tasks ``` ` with filters (status, due, tag, path) renders aggregated task list | Live-updating; filters: `done`, `not done`, `due before YYYY-MM-DD`, `tag:#x` |
| FR-WF-06 | Kanban board view: render tagged tasks or notes as columns on a drag-and-drop board | Board stored in a `.kanban` note; moving cards updates source note checkboxes |
| FR-WF-07 | Dataview-style queries: ` ```query ``` ` block with `TABLE`, `LIST`, `TASK` output from note metadata | Queries frontmatter properties; supports `WHERE`, `SORT`, `LIMIT`, `FROM` |

## Tier 5 -- Canvas (FR-CV)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-CV-01 | Infinite canvas: pannable/zoomable 2D workspace, min 10,000x10,000 virtual pixels | Smooth 60fps pan/zoom on trackpad and mouse; pinch-to-zoom on trackpad |
| FR-CV-02 | Note cards: embed existing notes as resizable cards on canvas | Card shows note title + content preview; double-click opens full editor |
| FR-CV-03 | Image and link embeds: drag images/URLs onto canvas as embedded cards | Images render inline; URLs show Open Graph preview (title + thumbnail) |
| FR-CV-04 | Text cards: freeform rich-text cards (subset of Tiptap) not linked to any note | Supports bold, italic, lists, code; editable in-place on canvas |
| FR-CV-05 | Arrow connections: draw directed/undirected arrows between any two cards | Arrow snaps to card edges; optional label text on arrow midpoint |
| FR-CV-06 | Groups: visual grouping of cards with named colored rectangle backgrounds | Cards inside group move together; group resizable; group label editable |
| FR-CV-07 | Canvas stored as JSON in `canvas` SQLite table; format: `{ nodes: [...], edges: [...], viewport }` | Canvas round-trips without data loss; viewport restored on reopen |

## Tier 6 -- Wiki (FR-WK)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-WK-01 | AI ingest pipeline: process sources via existing `sourceIngestion.ts` + embeddings into wiki page drafts | Each ingested source produces candidate wiki pages; user reviews before publish |
| FR-WK-02 | Wiki page types: entity, concept, topic, comparison, overview -- each with distinct template/schema | Page type selectable on creation; type determines required fields |
| FR-WK-03 | Wiki Index page: auto-generated alphabetical + categorical listing of all wiki pages | Regenerates on wiki page create/delete; accessible from sidebar |
| FR-WK-04 | Wiki Log: timestamped changelog of all wiki page creates, edits, and deletes | Log viewable in dedicated panel; entries link to affected pages |
| FR-WK-05 | Coverage indicators: show which sources have been wikified and which have gaps | Traffic-light badge on each source: green (covered), yellow (partial), red (uncovered) |
| FR-WK-06 | Confidence scores: AI-assigned 0-1 score per wiki page section based on source evidence strength | Score shown as colored bar per section; <0.5 flagged for review |
| FR-WK-07 | Wiki-first query: when user asks a question in chat, check wiki pages before RAG over raw sources | Chat pipeline checks wiki hits first; falls back to `rag.ts` if no wiki match |
| FR-WK-08 | "File Answer" button: from any chat answer, one-click creates/updates a wiki page with that content | Button in `ChatMessage.tsx`; opens pre-filled wiki page editor for review |
| FR-WK-09 | Lint engine: periodic scan of wiki for stale refs, broken links, contradictions, low-confidence sections | Lint results panel with severity levels; auto-fix suggestions for broken links |
| FR-WK-10 | Wiki browser: dedicated browse view with search, filter by type/tag, and page preview | Sidebar section or dedicated tab; supports same search operators as FR-ORG-04 |
| FR-WK-11 | Schema config: user-editable JSON schema defining custom fields per wiki page type | Schema editor in settings; changes apply to new pages; existing pages flagged for migration |

## Tier 7 -- AI-Native (FR-AI)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-AI-01 | Auto-tag suggestions: AI proposes tags based on note content; user accepts/rejects with one click | Suggestions appear below tag chips after 2s of idle; max 5 suggestions |
| FR-AI-02 | Auto-link suggestions: AI detects potential `[[link]]` targets in note text | Inline highlight with tooltip showing target note title; click to insert link |
| FR-AI-03 | Hybrid search: combine FTS (SQLite) + vector similarity (existing `vectorStore.ts`) with RRF fusion | Single search box returns merged results; vector weight configurable 0-1 |
| FR-AI-04 | Note summarization: generate 1-3 sentence summary of any note via AI | Button in note toolbar; summary stored in frontmatter `summary:` field |
| FR-AI-05 | Content generation from notes: select notes as context, prompt AI to generate new content | "Generate from notes" dialog; user selects notes + writes prompt; output is new note |
| FR-AI-06 | Voice notes: record audio, transcribe via existing `voiceSession.ts`, save as note | Record button in toolbar; transcription appears as note content; audio file attached |
| FR-AI-07 | Web clipper: save URL content as a note via IPC from system tray or keyboard shortcut | Uses existing `webScraper.ts`; extracted content saved as new note with source URL tag |
| FR-AI-08 | Inline AI assist: select text, right-click menu offers: rewrite, expand, summarize, translate, explain | Context menu in Tiptap editor; result replaces selection or inserts below |
| FR-AI-09 | AI uses configured chat provider from `providers/index.ts`; all AI features respect provider selection | Provider switchable in settings; all FR-AI features route through `getChatProvider()` |

---

## Non-Functional Requirements (NFR)

| ID | Category | Requirement | Metric |
|----|----------|-------------|--------|
| NFR-01 | Performance | Editor keystroke-to-render latency | <16ms (60fps frame budget) |
| NFR-02 | Performance | Full-text search response time for 10K notes | <200ms p95 |
| NFR-03 | Performance | Global graph renders 5,000 nodes smoothly | 30fps sustained, <2s initial layout |
| NFR-04 | Performance | Note open time (load from SQLite + render) | <100ms for notes under 50KB |
| NFR-05 | Performance | Auto-save debounce write to SQLite | <50ms per save operation |
| NFR-06 | Storage | Handle 10,000+ notes per notebook without degradation | List/search/graph remain within performance targets |
| NFR-07 | Storage | Single note size up to 1MB of markdown content | No truncation or corruption on save/load |
| NFR-08 | Storage | Canvas supports 500+ cards per canvas | Pan/zoom remains at 60fps |
| NFR-09 | Accessibility | All editor actions accessible via keyboard | WCAG 2.1 AA; no mouse-only interactions |
| NFR-10 | Accessibility | Screen reader support for note list, editor, and graph | ARIA labels on all interactive elements |
| NFR-11 | Accessibility | Respect OS reduced-motion preference | Graph animations and transitions disabled when prefers-reduced-motion |
| NFR-12 | Reliability | No data loss on crash: WAL mode SQLite + auto-save | Recovery test: kill process mid-edit, relaunch, content intact |
| NFR-13 | Reliability | Undo/redo stack: minimum 100 steps per session | Tiptap history extension; Cmd+Z / Cmd+Shift+Z |
| NFR-14 | Memory | App memory usage with 1,000 notes open in sidebar | <500MB RSS |
| NFR-15 | Startup | Notes system initial load time | <500ms from tab switch to interactive |

---

## Data Requirements (DR)

All new tables use Drizzle ORM in `src/main/db/schema.ts`. Existing `notes` table is migrated (not replaced).

| ID | Table | Key Columns | Relationships |
|----|-------|-------------|---------------|
| DR-01 | `notes` (alter) | Add: `folderId TEXT`, `content_tiptap JSON`, `frontmatter JSON`, `aliases JSON DEFAULT '[]'`, `bookmarked BOOLEAN DEFAULT false`, `lastOpenedAt TEXT` | `folderId` FK to `folders.id` |
| DR-02 | `folders` | `id TEXT PK`, `notebookId TEXT NOT NULL`, `parentId TEXT`, `name TEXT NOT NULL`, `sortOrder INTEGER`, `createdAt TEXT` | Self-referential `parentId` FK; `notebookId` FK to `notebooks.id` |
| DR-03 | `wiki_pages` | `id TEXT PK`, `notebookId TEXT NOT NULL`, `title TEXT NOT NULL`, `type TEXT NOT NULL` (entity/concept/topic/comparison/overview), `content JSON`, `confidence REAL`, `schemaVersion INTEGER`, `createdAt TEXT`, `updatedAt TEXT` | FK to `notebooks.id`; linked to `sources` via `wiki_page_sources` |
| DR-04 | `wiki_page_sources` | `wikiPageId TEXT`, `sourceId TEXT`, `coverageScore REAL` | Junction table: FK to `wiki_pages.id` and `sources.id` |
| DR-05 | `wiki_log` | `id TEXT PK`, `wikiPageId TEXT`, `action TEXT` (create/edit/delete), `diff JSON`, `timestamp TEXT` | FK to `wiki_pages.id` |
| DR-06 | `canvas` | `id TEXT PK`, `notebookId TEXT NOT NULL`, `title TEXT NOT NULL`, `data JSON NOT NULL` (nodes, edges, viewport), `createdAt TEXT`, `updatedAt TEXT` | FK to `notebooks.id` |
| DR-07 | `tasks` | `id TEXT PK`, `noteId TEXT NOT NULL`, `content TEXT`, `status TEXT` (open/done/cancelled), `dueDate TEXT`, `priority INTEGER`, `blockId TEXT`, `createdAt TEXT`, `completedAt TEXT` | FK to `notes.id`; `blockId` for block-ref anchor |
| DR-08 | `templates` | `id TEXT PK`, `notebookId TEXT`, `name TEXT NOT NULL`, `content TEXT NOT NULL`, `type TEXT` (note/daily/weekly/monthly), `createdAt TEXT` | Optional FK to `notebooks.id` (null = global) |
| DR-09 | `daily_notes` | `id TEXT PK`, `notebookId TEXT NOT NULL`, `noteId TEXT NOT NULL UNIQUE`, `date TEXT NOT NULL`, `type TEXT` (daily/weekly/monthly/quarterly/yearly) | FK to `notebooks.id` and `notes.id` |
| DR-10 | `note_properties` | `id TEXT PK`, `noteId TEXT NOT NULL`, `key TEXT NOT NULL`, `value TEXT`, `type TEXT` (text/number/date/list/checkbox) | FK to `notes.id`; unique on `(noteId, key)` |
| DR-11 | `note_links` (materialized) | `id TEXT PK`, `sourceNoteId TEXT NOT NULL`, `targetNoteId TEXT`, `targetTitle TEXT NOT NULL`, `linkType TEXT` (wiki/embed/block/heading), `blockId TEXT` | FK to `notes.id` for both; `targetNoteId` null if unresolved |
| DR-12 | `recent_notes` | `id TEXT PK`, `notebookId TEXT NOT NULL`, `noteId TEXT NOT NULL`, `openedAt TEXT NOT NULL` | FK to `notebooks.id` and `notes.id`; keep last 50, prune on insert |
| DR-13 | `wiki_schema_config` | `id TEXT PK`, `notebookId TEXT NOT NULL`, `pageType TEXT NOT NULL`, `schema JSON NOT NULL`, `updatedAt TEXT` | FK to `notebooks.id`; unique on `(notebookId, pageType)` |

---

## Integration Requirements (IR)

| ID | System | Requirement | Details |
|----|--------|-------------|---------|
| IR-01 | Vector Store | Index note content into existing `knowledge` table with `type: 'note'` | Reuse `embeddings.ts` + `tieredEmbeddings.ts`; re-embed on note save (debounced 5s) |
| IR-02 | Vector Store | Wiki pages indexed with `type: 'wiki'` added to `knowledge.type` enum | Enables hybrid search (FR-AI-03) to distinguish wiki vs note vs document results |
| IR-03 | AI Providers | All AI features (FR-AI-*) route through `getChatProvider()` in `providers/index.ts` | Provider selection from settings; streaming responses via existing adapter interface |
| IR-04 | AI Providers | Wiki ingest pipeline (FR-WK-01) uses configured provider for summarization + structuring | Falls back to Gemini Flash for cost efficiency if no provider explicitly set |
| IR-05 | Source Ingestion | "File Answer" (FR-WK-08) reuses `sourceIngestion.ts` for chunking wiki page content | Wiki pages become queryable sources in existing RAG pipeline |
| IR-06 | Chat System | Wiki-first query (FR-WK-07) inserts wiki lookup step before `rag.ts` in `chat.ts` IPC handler | If wiki provides high-confidence answer (>0.8), skip RAG; else merge results |
| IR-07 | IPC Layer | New IPC channels added to `IPC_CHANNELS` in `src/shared/types/ipc.ts` for all new CRUD ops | Follow existing pattern: typed `IpcHandlerMap` entries + preload bridge exports |
| IR-08 | Existing Notes | Migration: existing `notes.content` (plain text) converted to Tiptap JSON on first load | Lazy migration: convert when note is opened; `content_tiptap` null = legacy plain text |
| IR-09 | Voice Session | Voice notes (FR-AI-06) reuse `voiceSession.ts` for recording + transcription | Transcribed text inserted as Tiptap content; audio file path stored in frontmatter |
| IR-10 | Web Scraper | Web clipper (FR-AI-07) reuses `webScraper.ts` for URL content extraction | Extracted markdown converted to Tiptap JSON on save |
| IR-11 | Knowledge Hub | Graph view (FR-GR-*) integrates with existing `KnowledgeGraphTab.tsx` as optional combined view | Toggle between notes-only graph and knowledge+notes combined graph |

---

## Constraints (CON)

| ID | Constraint | Implication |
|----|-----------|-------------|
| CON-01 | Electron 39 runtime; all features must work within Electron's Chromium sandbox | No native OS APIs beyond what Electron exposes; use IPC for all main-process operations |
| CON-02 | Must not break existing notebook/source/chat/studio features | All existing IPC channels, DB tables, and UI components remain functional after upgrade |
| CON-03 | Offline-capable: all note editing, search, and graph features work without internet | AI features (FR-AI-*, FR-WK-01) degrade gracefully: show "offline" badge, queue requests |
| CON-04 | SQLite single-file database; no external database dependencies | All new tables in same Drizzle schema; WAL mode for concurrent reads |
| CON-05 | Drizzle ORM migrations must be backward-compatible; no destructive schema changes | Add columns with defaults; new tables only; never drop existing columns |
| CON-06 | Tiptap extensions must be tree-shakeable; bundle size increase <200KB gzipped for editor tier | Audit with `electron-builder --analyze`; lazy-load extensions not used in current view |
| CON-07 | All note data exportable as standard Markdown files (`.md`) | Export function converts Tiptap JSON back to CommonMark + Obsidian-flavored extensions |
| CON-08 | Graph rendering must not block main thread | Use Web Worker or OffscreenCanvas for force-directed layout computation |
| CON-09 | Canvas rendering must not block main thread | Use HTML5 Canvas or WebGL with requestAnimationFrame; virtualize off-screen cards |
| CON-10 | Respect existing dark/light theme system (Tailwind v4 dark mode classes) | All new components use existing `dark:` variant pattern; no hardcoded colors |

---

## Implementation Priority

| Phase | Tiers | Estimated Effort | Dependencies |
|-------|-------|-----------------|--------------|
| Phase 1 | Tier 1 (Editor) + DR-01, DR-11 | 4-6 weeks | Tiptap integration; migration system |
| Phase 2 | Tier 2 (Organization) + DR-02, DR-10, DR-12 | 3-4 weeks | Phase 1 (editor must exist) |
| Phase 3 | Tier 3 (Graph) | 2-3 weeks | Phase 1 (note_links table) |
| Phase 4 | Tier 4 (Workflows) + DR-07, DR-08, DR-09 | 3-4 weeks | Phase 1 + Phase 2 |
| Phase 5 | Tier 7 (AI-Native) | 2-3 weeks | Phase 1; existing AI infra |
| Phase 6 | Tier 6 (Wiki) + DR-03-05, DR-13 | 4-5 weeks | Phase 5 (AI pipeline) |
| Phase 7 | Tier 5 (Canvas) + DR-06 | 3-4 weeks | Phase 1 (embeds existing notes) |
