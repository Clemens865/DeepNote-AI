# DeepNote AI Notes Upgrade: Risk Matrix & Prioritized Roadmap

**Version:** 1.0
**Date:** 2026-04-06

---

## Risk Matrix

| # | Risk | Category | L(1-5) | I(1-5) | Score | Mitigation |
|---|------|----------|--------|--------|-------|------------|
| 1 | Tiptap editor performance degrades on notes >10K words with heavy embeds/math/mermaid | Technical | 3 | 5 | 15 | Virtual rendering for long docs; benchmark with realistic 15K-word research notes in Sprint 1; set hard perf budget (keystroke <16ms) |
| 2 | Force-directed graph layout freezes UI at 500+ nodes | Technical | 4 | 4 | 16 | Use WebGL renderer (force-graph lib); run layout in Web Worker; LOD rendering -- collapse clusters on zoom-out; lazy-load edges |
| 3 | Canvas infinite scroll + embedded rich editors causes memory leaks | Technical | 3 | 4 | 12 | Virtualize off-screen nodes; mount/unmount Tiptap instances on visibility; memory profiling gate before merge |
| 4 | Editor migration corrupts or loses existing plain-text notes | Integration | 2 | 5 | 10 | Plain text is valid markdown -- no conversion needed; write migration tests against every existing note format; keep read-only fallback to old textarea for 2 sprints |
| 5 | New IPC channels for notes/graph/wiki break existing chat/source IPC contracts | Integration | 2 | 4 | 8 | Extend `IpcHandlerMap` additively (no modifications to existing channels); integration test suite covering all existing IPC calls runs in CI |
| 6 | Feature creep toward full Obsidian parity (Vim mode, theming, publish, mobile) | Scope | 4 | 4 | 16 | Anti-goals doc is the gate; every feature must answer "Does this serve AI-assisted research?"; Sprint scope locked 1 week before start; no mid-sprint additions |
| 7 | Wiki generation quality varies wildly across providers (Groq/Gemini/Claude/OpenAI) | AI | 3 | 4 | 12 | Provider-agnostic structured output prompts; quality scoring with auto-retry on low score; confidence badges on wiki pages; user can regenerate with different provider |
| 8 | AI wiki hallucinates facts not in source material | AI | 3 | 5 | 15 | Strict grounding: every wiki claim must cite a source chunk; hallucination detection via cross-reference check; "ungrounded" flag on claims without citation |
| 9 | Wiki concept deduplication fails ("ML" vs "machine learning" creates separate pages) | AI | 3 | 3 | 9 | Embedding-based similarity check before page creation; merge UI for manual resolution; alias system for known synonyms |
| 10 | UX complexity overwhelms users -- too many panels, views, features at once | UX | 3 | 4 | 12 | Progressive disclosure: features hidden until user opts in; onboarding tooltips per tier; default layout is simple editor + sidebar; graph/canvas/wiki are explicit opt-in views |
| 11 | Daily notes + task aggregation query is slow with 500+ notes (full scan for `- [ ]`) | Technical | 3 | 3 | 9 | Indexed task store in SQLite (extracted on save); incremental index updates; query cache with invalidation on note edit |
| 12 | Backlink/unlinked-mention detection produces excessive false positives ("Paris" city vs person) | UX/AI | 3 | 3 | 9 | Disambiguation UI on link suggestions; context-aware matching (show surrounding sentence); "Ignore" option that persists; frequency threshold for suggestions |
| 13 | Concurrent wiki ingest of multiple sources causes merge conflicts on same wiki page | Technical | 2 | 4 | 8 | Queue ingest per wiki page (page-level lock); section-level merging for concurrent updates; conflict resolution UI as fallback |
| 14 | Tiptap extension ecosystem changes/breaks between versions | Technical | 2 | 3 | 6 | Pin Tiptap version; wrap all extensions in adapter layer; upgrade on our schedule with regression tests |

**Risk scoring**: L x I. Critical (>=15): items 1, 2, 6, 8. High (10-14): items 3, 4, 7, 10, 12. Medium (6-9): items 5, 9, 11, 13, 14.

---

## MoSCoW Prioritization

### Sprint 1: Editor Foundation

| Priority | Feature |
|----------|---------|
| **Must** | Tiptap markdown editor with live preview, headings, bold/italic, lists, code blocks |
| **Must** | `[[wiki links]]` with autocomplete dropdown |
| **Must** | `#tag` support with parsing |
| **Must** | Callout/admonition blocks (`> [!note]`, `> [!warning]`) |
| **Must** | LaTeX math rendering (inline `$` and block `$$`) |
| **Must** | Migration path preserving all existing notes |
| **Should** | Mermaid diagram rendering |
| **Should** | Block references (`![[note#section]]`) |
| **Should** | Image/embed support |
| **Could** | Slash command menu (`/heading`, `/callout`, `/code`) |
| **Could** | Table editing |
| **Won't** | Vim mode, custom themes, export formats |

### Sprint 2: Organization & Search

| Priority | Feature |
|----------|---------|
| **Must** | Folder tree with drag-and-drop nesting |
| **Must** | Quick switcher (`Cmd+O`) with fuzzy search |
| **Must** | Full-text search across all notes |
| **Must** | Note outline panel (heading hierarchy) |
| **Should** | Command palette (`Cmd+P`) with action search |
| **Should** | Bookmarks / pinned notes |
| **Should** | Frontmatter properties (YAML metadata) |
| **Could** | Recent notes list |
| **Could** | Sort/filter options in sidebar |
| **Won't** | Tag hierarchy, nested tags |

### Sprint 3: Knowledge Graph

| Priority | Feature |
|----------|---------|
| **Must** | Global graph view (force-directed, all notes + links) |
| **Must** | Local graph view (neighbors of current note) |
| **Must** | Backlink panel on each note |
| **Must** | Unlinked mention detection with "Link" action |
| **Should** | Graph filters (by tag, date range, note type) |
| **Should** | Node click navigates to note |
| **Could** | Cluster detection and labeling |
| **Could** | Orphan notes section |
| **Won't** | 3D graph, graph export, cluster summarization (deferred to Sprint 6) |

### Sprint 4: Workflows

| Priority | Feature |
|----------|---------|
| **Must** | Daily notes with auto-creation and templates |
| **Must** | Template system with variables (`{{date}}`, `{{title}}`) |
| **Must** | Task checkboxes with indexed task store |
| **Should** | Task aggregation query (pull open tasks into daily note) |
| **Should** | Periodic notes (weekly, monthly) |
| **Could** | Kanban view for tasks |
| **Could** | Dataview-style inline queries |
| **Won't** | Habit trackers, calendar integration, Gantt charts |

### Sprint 5: Knowledge Wiki

| Priority | Feature |
|----------|---------|
| **Must** | AI wiki page generation from ingested sources |
| **Must** | Incremental wiki updates (new source enriches existing pages) |
| **Must** | Source attribution on every wiki claim |
| **Must** | Wiki pages appear in `[[link]]` autocomplete and graph |
| **Must** | Query-wiki-first pipeline (wiki before RAG fallback) |
| **Should** | Contradiction detection with side-by-side citation view |
| **Should** | Coverage indicators (what topics are well-covered vs gaps) |
| **Should** | Human-edit protection (AI does not overwrite user edits) |
| **Could** | Wiki lint dashboard |
| **Could** | Concept deduplication / alias system |
| **Won't** | Auto-publish, wiki versioning history, wiki export |

### Sprint 6: Canvas + AI-Native

| Priority | Feature |
|----------|---------|
| **Must** | Infinite canvas with pan/zoom |
| **Must** | Drag notes onto canvas as cards |
| **Must** | Freeform text nodes and directional arrows |
| **Must** | AI auto-tagging suggestions on note save |
| **Should** | Inline editing on canvas cards |
| **Should** | AI auto-link suggestions (unlinked mention + semantic) |
| **Should** | "Summarize Selection" on canvas clusters |
| **Should** | Color-coding and grouping on canvas |
| **Could** | Voice-to-note transcription |
| **Could** | Web clipper (save URL as source) |
| **Could** | Canvas export (PNG/SVG) |
| **Won't** | Collaborative canvas, mobile canvas, AI-generated canvas layouts |

---

## Phased Roadmap

### Sprint 1: Editor Foundation (3 weeks)

**Goal:** Replace the plain textarea with a Tiptap-based rich markdown editor. This is the single change that unlocks every subsequent tier.

**Key Deliverables:**
- Tiptap editor integrated into the notes panel, replacing textarea
- Live markdown preview: headings (H1-H6), bold, italic, strikethrough, inline code, code blocks with syntax highlighting
- Ordered/unordered lists, blockquotes, horizontal rules
- `[[wiki link]]` syntax with autocomplete dropdown (searches existing notes by title)
- `#tag` parsing and highlighting
- Callout blocks (`> [!note]`, `> [!warning]`, `> [!quote]` etc.)
- LaTeX math rendering (KaTeX: inline `$...$` and block `$$...$$`)
- Migration: existing plain-text notes load correctly in new editor (plain text = valid markdown)
- Keyboard shortcuts: `Cmd+B`, `Cmd+I`, `Cmd+K` (link), standard editing

**Dependencies:** None. Tiptap already exists in the codebase (used in Studio).

**Validation Criteria:**
- All existing notes render without data loss in new editor
- Keystroke latency <16ms on a 5,000-word note with 10+ embeds
- Wiki link autocomplete returns results in <100ms with 200+ notes
- Callouts, math, and code blocks render correctly in live preview

**Complexity:** L (Large) -- Tiptap extension configuration, custom nodes for callouts/math/wikilinks, migration testing, performance tuning.

---

### Sprint 2: Organization & Search (2 weeks)

**Goal:** Give users a way to organize and find notes. Move from flat list to hierarchical folders with instant search.

**Key Deliverables:**
- Folder tree in sidebar with create/rename/delete/drag-drop
- SQLite schema for folder hierarchy (parent_id, sort_order)
- Quick switcher modal (`Cmd+O`): fuzzy search across note titles and folder paths
- Full-text search (`Cmd+Shift+F`): search note content, results with context snippets
- FTS5 virtual table in SQLite for search indexing
- Note outline panel: auto-generated heading tree for current note, click to scroll
- Command palette (`Cmd+P`): search actions (create note, open graph, toggle sidebar)
- Bookmarks: pin notes to top of sidebar

**Dependencies:** Sprint 1 (editor must parse headings for outline; structured content for search indexing).

**Validation Criteria:**
- Folder operations (create, move, nest 3 levels deep) work with undo
- Full-text search returns results in <200ms across 500 notes
- Quick switcher matches on partial title with typo tolerance
- Outline panel updates live as user adds/removes headings

**Complexity:** M (Medium) -- SQLite schema + FTS5 is well-understood; folder tree UI is standard; search is the main technical challenge.

---

### Sprint 3: Knowledge Graph (2 weeks)

**Goal:** Visualize the knowledge graph. Make implicit connections visible and actionable.

**Key Deliverables:**
- Global graph view: force-directed layout using force-graph (WebGL), all notes as nodes, `[[links]]` as edges
- Local graph view: 1-hop neighborhood of the currently open note
- Backlink panel: list of notes that link to the current note, with context snippets
- Unlinked mention detection: scan notes for text matching other note titles without `[[]]`; offer "Link" action
- Graph filters: filter by tag, show/hide orphans, date range slider
- Node interaction: click to navigate, hover for preview tooltip
- Graph layout computed in Web Worker to avoid UI blocking

**Dependencies:** Sprint 1 (wiki links must be parseable from editor content).

**Validation Criteria:**
- Graph renders 500 nodes + 2000 edges at 60fps pan/zoom
- Backlink panel updates within 500ms of saving a note with new links
- Unlinked mentions detected with <5% false positive rate on test corpus
- Graph filter interactions feel instant (<100ms)

**Complexity:** M (Medium) -- force-graph library handles rendering; main work is link extraction pipeline, Web Worker integration, and unlinked mention scanning.

---

### Sprint 4: Workflows (3 weeks)

**Goal:** Enable daily knowledge work routines. Templates, daily notes, and task management.

**Key Deliverables:**
- Daily notes: auto-create from template on app open, navigate by date, link to previous day
- Template system: user-defined templates stored as notes in a `/templates` folder; template variables (`{{date}}`, `{{day}}`, `{{title}}`, `{{previous_daily}}`) resolved on instantiation
- Template picker via command palette: "New from template"
- Task checkboxes: `- [ ]` / `- [x]` rendered as interactive checkboxes in editor
- Task index: SQLite table extracting tasks from all notes on save (note_id, task_text, completed, line_number)
- Task aggregation: embed `![[tasks-inbox]]` or a query block to pull open tasks from across notes
- Periodic notes: weekly/monthly note templates with auto-creation

**Dependencies:** Sprints 1-2 (editor for checkboxes, folders for template storage, search index for task queries).

**Validation Criteria:**
- Daily note auto-creates on app open with correct date and template
- Checking a task in daily note view updates the source note within 1 second
- Task query returns all open tasks from 500 notes in <300ms
- Templates resolve all variables correctly including `{{previous_daily}}` with weekend gaps

**Complexity:** L (Large) -- Task indexing, bidirectional checkbox sync, template variable resolution, daily note date logic with timezone handling.

---

### Sprint 5: Knowledge Wiki (4 weeks)

**Goal:** Implement the Karpathy LLM Wiki concept. AI maintains persistent, structured wiki pages from ingested sources.

**Key Deliverables:**
- Wiki ingest pipeline: on source addition, AI extracts key concepts/entities and generates wiki page stubs
- Incremental enrichment: new sources update existing wiki pages with new information and citations
- Source attribution: every wiki claim links to source + page/section
- Wiki pages are first-class notes: appear in `[[link]]` autocomplete, graph, search, folders (auto-organized under `/wiki`)
- Human-edit protection: AI-generated sections tagged; user edits never overwritten by subsequent ingests
- Contradiction detection: flag conflicting claims across sources with side-by-side citation view
- Coverage indicators: visual badges showing topic coverage depth (sparse/moderate/thorough)
- Query-wiki-first pipeline: AI chat checks wiki pages before falling back to raw RAG chunk retrieval
- Confidence scoring: wiki pages show confidence level based on number/quality of supporting sources

**Dependencies:** Sprints 1-3 (editor for wiki page rendering, folders for `/wiki` organization, graph for wiki page nodes and edges, backlinks for citation navigation).

**Validation Criteria:**
- Ingesting a 40-page PDF generates 5-15 wiki pages within 60 seconds
- Ingesting a second source on overlapping topics enriches existing pages (not duplicates)
- Every claim on a wiki page has a clickable source citation
- Contradiction detected when two sources disagree on a quantitative claim
- Chat query on a wiki-covered topic answers from wiki with <2s latency (vs ~5s for full RAG)
- User edits to a wiki page survive subsequent source ingests

**Complexity:** L (Large) -- This is the most technically ambitious sprint. Concept extraction, deduplication, incremental merge, contradiction detection, and the query-wiki-first pipeline are all novel.

---

### Sprint 6: Canvas + AI-Native (4 weeks)

**Goal:** Spatial thinking canvas and AI-powered automation layer. The "wow" features that complete the vision.

**Key Deliverables:**
- Infinite canvas: pan/zoom workspace, create via sidebar "New Canvas"
- Note cards: drag notes from sidebar onto canvas; show title + preview
- Freeform nodes: text cards created directly on canvas, color-coded
- Arrows: directional connections between nodes, optional labels
- Grouping: select multiple nodes and group with a bounding box + label
- Inline editing: double-click a card to edit with full rich editor
- Canvas persistence: stored in SQLite, auto-save
- Canvas links appear in graph: arrows optionally create `[[links]]`
- AI auto-tagging: on note save, suggest tags based on content analysis
- AI auto-linking: suggest `[[links]]` for unlinked concepts (semantic, not just text match)
- "Summarize Selection": select canvas nodes, AI generates grounded synthesis
- Voice-to-note: record audio, transcribe via Whisper/provider, create note (Could)
- Web clipper: paste URL, extract content, add as source (Could)

**Dependencies:** Sprints 1-2 (editor for inline editing, folders for canvas storage), Sprint 5 (wiki pages on canvas, summarization grounded in wiki).

**Validation Criteria:**
- Canvas with 100 nodes maintains 60fps pan/zoom
- Drag-and-drop from sidebar to canvas works reliably
- Auto-tag suggestions are relevant (>70% acceptance rate in testing)
- "Summarize Selection" produces grounded output citing the selected nodes
- Canvas state persists and restores correctly across app restarts

**Complexity:** L (Large) -- Canvas rendering, Tiptap-in-canvas mounting/unmounting, AI feature integration, voice transcription pipeline.

---

## MVP Definition

**MVP = Sprint 1 (Editor) + Sprint 2 (Organization)**

### What It Delivers

The MVP transforms DeepNote from "AI chat with a scratchpad" into "AI chat with a proper notes system." Specifically:

1. **Rich writing experience.** Users can write formatted research notes with headings, code blocks, math, callouts, and diagrams. Notes look like they do in Obsidian, not like a textarea.

2. **Bidirectional linking.** `[[wiki links]]` with autocomplete create a web of connected notes. This is the foundation for every subsequent tier.

3. **Organization at scale.** Folders, full-text search, and quick switcher mean users with 100+ notes can find and organize efficiently.

4. **Note outline.** Heading hierarchy panel enables navigation within long research notes.

5. **No data loss.** Existing plain-text notes are valid markdown and render correctly in the new editor.

### What It Does NOT Deliver

- No graph visualization (Sprint 3)
- No AI wiki pages (Sprint 5)
- No daily notes or templates (Sprint 4)
- No canvas (Sprint 6)
- No AI-powered auto-tagging or auto-linking (Sprint 6)

### MVP Value Proposition

> "Write real research notes in DeepNote with the same markdown experience you get in Obsidian, organized in folders with instant search -- without leaving the app where your AI assistant and sources already live."

This is sufficient for users to stop switching to Obsidian/Notion for note-taking. The linking system planted in the MVP is the seed for the knowledge graph, wiki, and AI-native features that follow.

### MVP Timeline: 5 weeks
- Sprint 1: 3 weeks
- Sprint 2: 2 weeks

### MVP Success Metric

80% of active users create at least one formatted note (headings, bold, code, or links) within 30 days of shipping. Average notes per user increases 3x within 60 days.
