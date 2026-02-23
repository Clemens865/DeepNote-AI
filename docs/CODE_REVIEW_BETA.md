# Code Review — Beta Release

Full code review of the DeepNote AI codebase, conducted February 2026. Covers all main process services, IPC handlers, renderer components, shared types, and configuration.

---

## Architecture Summary

| Layer | Files | Purpose |
|-------|-------|---------|
| **Main Process** | `src/main/` | Electron backend: IPC handlers, AI services, database, config |
| **Renderer** | `src/renderer/` | React UI: components, stores, hooks, styles |
| **Shared** | `src/shared/` | TypeScript types, IPC channel definitions, provider config |
| **Preload** | `src/preload/` | Context bridge exposing 76 IPC channels to renderer |
| **Database** | SQLite + Drizzle ORM | 8 tables with WAL mode, foreign keys, cascading deletes |

---

## Service Inventory (17 Services)

| Service | File | Lines | Purpose |
|---------|------|-------|---------|
| AI Service | `ai.ts` | ~1010 | Chat, content generation, planning, prompts |
| AI Middleware | `aiMiddleware.ts` | ~234 | JSON validation, structure checks, retry pipeline |
| Agentic RAG | `agenticRag.ts` | ~180 | Multi-query retrieval with sufficiency checks |
| RAG Service | `rag.ts` | ~64 | Standard/agentic RAG dispatcher |
| Config Service | `config.ts` | ~89 | Persistent JSON config (API keys, models) |
| TTS Service | `tts.ts` | ~111 | Multi-speaker podcast audio generation |
| Imagen Service | `imagen.ts` | ~331 | AI image generation for slides/infographics |
| DeepBrain Service | `deepbrain.ts` | ~382 | System-wide memory, file/email search |
| Generation Pipeline | `generationPipeline.ts` | ~209 | Research → Write → Review pipeline |
| Embeddings | `embeddings.ts` | ~66 | Gemini cloud embeddings with rate limit handling |
| Tiered Embeddings | `tieredEmbeddings.ts` | ~94 | ONNX → Gemini → hash fallback strategy |
| Vector Store | `vectorStore.ts` | ~144 | File-based JSON vector storage + cosine search |
| Memory Service | `memory.ts` | ~264 | Cross-session AI memory (store, extract, query) |
| Voice Session | `voiceSession.ts` | ~204 | Audio transcription → chat → TTS pipeline |
| Source Ingestion | `sourceIngestion.ts` | ~197 | Parse → chunk → embed → store pipeline |
| Document Parser | `documentParser.ts` | ~200 | PDF, DOCX, TXT, MD, URL, YouTube, Audio parsing |
| Workspace | `workspace.ts` | ~150 | File tree scanning, .gitignore, sync |

---

## IPC Handler Inventory (76 Channels)

| Group | Count | Handlers |
|-------|-------|----------|
| Notebooks | 7 | LIST, CREATE, GET, UPDATE, DELETE, UPLOAD_COVER, EXPORT |
| Sources | 5 | LIST, ADD, DELETE, TOGGLE, RECOMMENDATIONS |
| Notes | 4 | LIST, CREATE, UPDATE, DELETE |
| Chat | 5 | MESSAGES, SEND, SAVE_MESSAGE, CLEAR, GENERATE_FROM_CONTEXT |
| Studio | 8 | GENERATE, STATUS, LIST, DELETE, RENAME, SUGGEST_FORMATS, SAVE_FILE, EXPORT_PDF |
| Image Slides | 2 | START, UPDATE_TEXT |
| Infographic | 1 | START |
| White Paper | 2 | START, EXPORT_PDF |
| Config | 5 | GET_API_KEY, SET_API_KEY, TEST_API_KEY, GET_CHAT_CONFIG, SET_CHAT_CONFIG |
| Workspace | 13 | LINK, UNLINK, SCAN, DIFF, SELECT, DESELECT, READ, WRITE, CREATE_FILE, DELETE_FILE, CREATE_DIR, FILES, SYNC |
| Voice | 3 | START, SEND_AUDIO, STOP |
| Memory | 3 | LIST, DELETE, CLEAR |
| DeepBrain | 9 | STATUS, RECALL, SEARCH, CLIPBOARD, REMEMBER, THINK, CONFIGURE, SEARCH_EMAILS, ACTIVITY_CURRENT |
| Search | 1 | GLOBAL |
| System | 3 | OPEN_FILE, DIALOG_OPEN_FILE, DIALOG_OPEN_DIRECTORY |
| Editor | 1 | AI_REWRITE |
| Research | 1 | DEEP_RESEARCH_START |
| API | 1 | DEEPNOTE_API_STATUS |

All 76 channels are fully typed across IPC definitions, preload bridge, and handlers.

---

## Component Inventory (40+ Components)

### Chat (7)
- `ChatPanel` — Main chat interface with streaming, artifact shortcuts, model selection
- `ChatInput` — Text input with file upload
- `ChatMessage` — Markdown rendering, artifacts, citations, action buttons
- `ChatDeepBrainResults` — DeepBrain preview cards (files, emails, memories)
- `VoiceOverlay` — Voice Q&A recording/playback overlay
- `ChatArtifactChart` — Recharts bar/line/pie visualizations
- `ChatArtifactTable/Mermaid/Kanban/KPI/Timeline` — Rich artifact renderers

### Studio (10)
- `StudioPanel` — Content list, filtering, searching, renaming
- `ToolGrid` — 15 generation tools with status indicators
- `GeneratedContentView` — Router for content type viewers
- `ImageSlidesView` — Slide viewer, fullscreen, hybrid editor, PDF export
- `ImageSlidesWizard` — Multi-step slide generation wizard
- `InfographicWizard` — Infographic generation wizard
- `WhitePaperWizard` — White paper generation wizard
- `DraggableTextElement` — Draggable/editable text overlays (Tiptap)
- `SlideEditorToolbar` — Rich text formatting toolbar
- `StudioCustomizeDialog` — Custom instructions dialog
- Viewers: `AudioOverviewView`, `FlashcardView`, `QuizView`, `ReportView`, `MindMapView`, `DataTableView`, `SlidesView`, `DashboardView`, `WhitePaperView`, `InfographicView`, `LiteratureReviewView`, `CompetitiveAnalysisView`, `DiffView`, `CitationGraphView`

### Common (6)
- `SettingsModal` — API keys, provider selection, DeepBrain config
- `Modal` — Portal-based dialog
- `Button`, `Spinner`, `Toast`, `NotebookIcon`

### Layout (3)
- `AppLayout` — Root layout with clipboard integration
- `Header` — Navigation, export, search, theme toggle
- `ResizablePanel` — Draggable split pane

### Dashboard (3)
- `Dashboard` — Notebook grid with create/search
- `NotebookCard` — Individual notebook card
- `CardCustomizeModal` — Card appearance customization

### Other (8)
- Sources: `SourcesPanel`, `SourceList`, `AddSourceModal`
- Notes: `NotesPanel`, `NoteEditor`
- Search: `GlobalSearchDialog`
- Workspace: `WorkspaceLayout`, `FileTreeView`, `FileTreeNode`, `FileEditor`
- Help: `ManualDialog`

---

## Issues Found

### Critical

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 1 | **No error boundaries** | Chat artifact rendering | Malformed artifact data crashes the entire chat message. Add `<ErrorBoundary>` wrappers around artifact components |
| 2 | **Race condition in chat streaming** | `ChatPanel.tsx` | Sending a message while a previous stream is active reassigns `cleanupRef.current` without waiting for the prior stream to finish — can drop partial messages |
| 3 | **Memory leak in VoiceOverlay** | `VoiceOverlay.tsx` | If user closes the overlay before stopping recording, `stream.getTracks()` never gets stopped. The media stream leaks |
| 4 | **API keys stored as plaintext** | `config.ts` | Keys written to `config.json` unencrypted. Should use electron-keychain or OS credential store |

### High Priority

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 5 | Race condition in studio generation | `ToolGrid.tsx` | No guard against rapid double-clicks — can spawn duplicate generations |
| 6 | Event listener leaks | `Header.tsx`, `StudioPanel.tsx` | Click-outside handlers recreated on every state change without cleanup |
| 7 | No debounce on search | `Dashboard.tsx` | Array filter runs on every keystroke without debounce |
| 8 | Settings password field UX | `SettingsModal.tsx` | Focusing a masked key field (`••••••••`) clears it — users can lose their key if they blur/refocus |
| 9 | Stale closures in keyboard handlers | `ImageSlidesView.tsx` (fixed), `Header.tsx` | Event listeners capture stale references if handlers change between renders |
| 10 | Missing cleanup in ImageSlidesWizard | `ImageSlidesWizard.tsx` | If user closes wizard mid-generation, progress listeners stay active |

### Medium Priority

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 11 | No list virtualization | `ChatPanel`, `StudioPanel` | Long message/item lists cause performance degradation |
| 12 | Vector search scales poorly | `vectorStore.ts` | Linear scan of all JSON files per search — no indexing |
| 13 | Config reads disk every call | `config.ts` | `getApiKey()` reads `config.json` from disk on every invocation |
| 14 | Audio/slide cache unbounded | `tts.ts`, `imagen.ts` | Generated files accumulate in userData with no cleanup |
| 15 | Memories accumulate forever | `memory.ts` | No expiration or TTL mechanism for old memories |
| 16 | Voice sessions can orphan | `voiceSession.ts` | Sessions stored in memory Map with no timeout — persist until app restart |
| 17 | Search debounce ordering | `GlobalSearchDialog.tsx` | Previous timeout can fire after new search starts, showing stale results |
| 18 | No retry on API failures | `ai.ts` | Chat and content generation have no retry logic (unlike embeddings which has 3x backoff) |
| 19 | Hardcoded model IDs | 10+ files | `gemini-3-flash-preview` appears in 8+ places — should be centralized in config |
| 20 | ResizablePanel no touch support | `ResizablePanel.tsx` | Mouse-only — no `onTouchStart` handler for tablets |

### Low Priority

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 21 | Missing ARIA labels | Throughout | Icon-only buttons lack `aria-label` attributes |
| 22 | No focus trapping in modals | `Modal.tsx` | Missing `role="dialog"`, `aria-modal`, focus trap |
| 23 | Toast stacking | `Toast.tsx` | Multiple toasts can overlap visually |
| 24 | Dark theme color mismatches | `globals.css` | Base `#050505` doesn't match component `dark:bg-zinc-900` |
| 25 | Firefox scrollbar styling | `globals.css` | WebKit-only scrollbar CSS — Firefox shows native scrollbars |

---

## Positive Findings

| Area | Assessment |
|------|-----------|
| **Type safety** | Excellent — 76 IPC channels fully typed across all 3 layers (IPC defs, preload, handlers) |
| **IPC architecture** | Solid — no orphaned channels, no type mismatches between layers |
| **Fire-and-forget patterns** | Well-implemented for async generation (slides, infographics, whitepapers) with broadcast progress |
| **DeepBrain integration** | Clean graceful degradation — 2s timeout, silent failures, 10s availability cache |
| **Embeddings fallback** | Three-tier system (ONNX → Gemini → hash) ensures embeddings always work |
| **AI validation middleware** | Smart retry with error feedback — JSON stripping, structure validation, 3 attempts |
| **Agentic RAG** | Multi-query + sufficiency check is a meaningful improvement over single-query RAG |
| **Database schema** | Proper WAL mode, foreign keys, cascading deletes, indexes on foreign keys |
| **Build pipeline** | Clean TypeScript composite builds with separate node/web configs |

---

## Dependency Health

| Package | Current | Latest | Gap | Risk |
|---------|---------|--------|-----|------|
| `drizzle-orm` | 0.36.4 | 0.45.1 | 9 minor | Medium — test before upgrading |
| `@google/genai` | 1.40.0 | 1.42.0 | 2 minor | Low |
| `electron` | 39.5.1 | 40.6.0 | 1 major | Medium |
| `@anthropic-ai/sdk` | 0.77.0 | 0.78.0 | 1 minor | Low |
| `@tiptap/*` | 3.19.0 | 3.20.0 | 1 minor | Low |

---

## Recommendations (Prioritized)

### Immediate (before next release)
1. Add `<ErrorBoundary>` wrappers around all artifact renderers in ChatMessage
2. Guard against double-click generation in ToolGrid (disable button while generating)
3. Fix VoiceOverlay media stream cleanup on unmount
4. Debounce dashboard search input

### Short-term
5. Add in-memory LRU cache for config reads
6. Add cache cleanup task for audio/slide files (7-day retention)
7. Add session timeout for voice sessions (30 min idle)
8. Centralize model IDs in config instead of hardcoding
9. Add retry logic to AI chat/generation (matching embeddings pattern)

### Medium-term
10. Virtualize chat message and studio item lists (`react-virtual`)
11. Migrate API key storage to OS keychain (`electron-keytar`)
12. Add structured logging with request IDs
13. Add accessibility audit (axe-core)
14. Add component-level error boundaries
