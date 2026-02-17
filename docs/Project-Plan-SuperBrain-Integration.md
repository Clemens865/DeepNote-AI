# DeepNote AI x SuperBrain Integration — Project Plan

**Version 1.1 — February 2026**

---

## Overview

Transform DeepNote AI from a per-notebook tool into a cognitive operating layer for macOS through **bidirectional integration** with SuperBrain. SuperBrain handles OS-level services (file indexing, clipboard, Spotlight, ONNX embeddings, Ollama, cognitive cycles); DeepNote AI provides the rich notebook UI and content generation engine. Both systems expose local REST APIs and learn from each other, creating a compounding intelligence flywheel.

### Prerequisites

- SuperBrain app running (Tauri menu bar app)
- SuperBrain REST API on `localhost:19519`
- Ollama installed with models downloaded (optional but recommended)

---

## Phase 1: Foundation — SuperBrain Bridge Service

**Goal**: Establish the HTTP connection between DeepNote and SuperBrain. All subsequent phases build on this.

**Estimated effort**: 1-2 days

### 1.1 Create SuperBrain Bridge Service

**New file**: `src/main/services/superbrain.ts` (~200 lines)

```typescript
// Core API client wrapping SuperBrain's REST endpoints
class SuperBrainService {
  private baseUrl = 'http://127.0.0.1:19519'
  private apiToken?: string

  // Connection
  async isAvailable(): Promise<boolean>        // GET /api/health
  async getStatus(): Promise<SystemStatus>     // GET /api/status

  // Cognitive operations
  async think(input: string): Promise<ThinkResponse>
  async remember(content: string, type?: MemoryType, importance?: number): Promise<RememberResponse>
  async recall(query: string, limit?: number): Promise<RecallItem[]>

  // Search
  async searchFiles(query: string, limit?: number): Promise<FileResult[]>

  // Clipboard
  async getClipboardHistory(limit?: number): Promise<ClipboardEntry[]>

  // Configuration
  async getSettings(): Promise<SuperBrainSettings>
  setApiToken(token: string): void
  setPort(port: number): void
}
```

**Key design decisions**:
- Singleton instance (like `configService`, `ragService`)
- All methods return `null` or empty arrays when SuperBrain is offline (graceful degradation)
- 2-second timeout on all HTTP calls to avoid blocking DeepNote
- Connection status cached for 10 seconds to avoid hammering health endpoint

### 1.2 Add SuperBrain Types

**Modified file**: `src/shared/types/index.ts`

```typescript
interface SuperBrainStatus {
  available: boolean
  memoryCount: number
  thoughtCount: number
  aiProvider: string
  embeddingProvider: string
  learningTrend: string
  indexedFiles: number
}

interface SuperBrainRecallItem {
  id: string
  content: string
  similarity: number
  memoryType: string
}

interface SuperBrainFileResult {
  path: string
  name: string
  chunk: string
  similarity: number
  fileType: string
}

interface ClipboardEntry {
  content: string
  timestamp: number
}
```

### 1.3 Register IPC Handlers

**New file**: `src/main/ipc/superbrain.ts` (~80 lines)

```typescript
// IPC channels:
// superbrain:status     → SuperBrainStatus
// superbrain:recall     → RecallItem[]
// superbrain:search     → FileResult[]
// superbrain:clipboard  → ClipboardEntry[]
// superbrain:remember   → RememberResponse
// superbrain:think      → ThinkResponse
// superbrain:configure  → void (set port/token)
```

### 1.4 Add Preload Bridge

**Modified file**: `src/preload/index.ts`

Add 7 new API methods:
- `superbrainStatus()`
- `superbrainRecall(args)`
- `superbrainSearch(args)`
- `superbrainClipboard(args)`
- `superbrainRemember(args)`
- `superbrainThink(args)`
- `superbrainConfigure(args)`

### 1.5 Add Connection Settings

**Modified file**: `src/renderer/src/components/common/SettingsModal.tsx`

Add a "SuperBrain" section:
- Connection status indicator (green dot / red dot)
- API port input (default: 19519)
- API token input (optional)
- "Test Connection" button
- Memory count, indexed files count, learning trend display

### Verification

- [ ] `npm run typecheck` passes
- [ ] SuperBrain status shows in Settings when running
- [ ] Graceful "Not connected" when SuperBrain is off
- [ ] All 7 IPC methods work

---

## Phase 2: DeepNote REST API (Bidirectional)

**Goal**: Expose DeepNote's knowledge as a local REST API so SuperBrain, shell scripts, Raycast, and other tools can query notebooks, sources, chat history, and generated content.

**Estimated effort**: 1.5 days

### 2.1 Create DeepNote API Server

**New file**: `src/main/services/deepnoteApi.ts` (~250 lines)

An Express-like HTTP server running inside Electron's main process on `localhost:19520`.

```typescript
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { getDatabase, schema } from '../db'
import { ragService } from './rag'

class DeepNoteApiServer {
  private server: ReturnType<typeof createServer> | null = null
  private port = 19520

  start(): void       // Start listening
  stop(): void        // Graceful shutdown
  setPort(port: number): void
}
```

Uses Node.js built-in `http` module (no Express dependency needed). Simple route matching.

### 2.2 API Endpoints

```
GET  /api/health
  → { ok: true, notebooks: number, version: string }

GET  /api/notebooks
  → [{ id, title, description, sourceCount, createdAt }]

GET  /api/notebooks/:id/sources
  → [{ id, title, type, contentPreview (first 500 chars), isSelected }]

GET  /api/notebooks/:id/sources/:sourceId/content
  → { id, title, type, content (full text) }

GET  /api/notebooks/:id/chat?limit=20
  → [{ id, role, content, citations, createdAt }]

GET  /api/notebooks/:id/content
  → [{ id, type, title, status, createdAt }]

GET  /api/notebooks/:id/content/:contentId
  → { id, type, title, data (full generated content), createdAt }

GET  /api/notebooks/:id/notes
  → [{ id, title, content, createdAt }]

POST /api/search
  body: { query: string, notebookId?: string, limit?: number }
  → [{ notebookId, notebookTitle, sourceTitle, chunk, similarity }]

POST /api/remember
  body: { notebookId: string, content: string, role?: 'user' | 'assistant' }
  → { id, notebookId, role, content, createdAt }
  (Saves a chat message — allows SuperBrain to inject knowledge into notebooks)

GET  /api/stats
  → { totalNotebooks, totalSources, totalMessages, totalGenerated, totalNotes }
```

### 2.3 Authentication

Optional Bearer token authentication (configurable in DeepNote settings):

```typescript
// Only accept requests with valid token (if configured)
if (apiToken && req.headers.authorization !== `Bearer ${apiToken}`) {
  res.writeHead(401)
  res.end(JSON.stringify({ error: 'Unauthorized' }))
  return
}
```

### 2.4 CORS Headers

Allow requests from SuperBrain's Tauri webview and local tools:

```typescript
res.setHeader('Access-Control-Allow-Origin', '*')
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
```

### 2.5 Start API on App Launch

**Modified file**: `src/main/index.ts`

```typescript
import { deepnoteApiServer } from './services/deepnoteApi'

app.whenReady().then(() => {
  // ... existing setup ...
  deepnoteApiServer.start()
})

app.on('will-quit', () => {
  deepnoteApiServer.stop()
})
```

### 2.6 API Settings UI

**Modified file**: `src/renderer/src/components/common/SettingsModal.tsx`

Add "DeepNote API" section under the SuperBrain section:
- Toggle: Enable/disable API server
- Port input (default: 19520)
- API token input (optional)
- Status: "Listening on localhost:19520"
- Copy curl example button

### 2.7 SuperBrain Configuration

SuperBrain needs to know DeepNote's API URL. Two approaches:

**Option A**: Add to SuperBrain's settings manually (user configures `deepnote_api_url`)
**Option B**: DeepNote registers itself with SuperBrain on startup via `POST /api/remember`:

```typescript
// On startup, tell SuperBrain about DeepNote
superbrainService.remember(
  'DeepNote AI API is available at http://127.0.0.1:19520. ' +
  'Query /api/notebooks for notebook list, /api/search for semantic search.',
  'procedural',
  1.0
)
```

Recommended: **Both** — register on startup AND document in SuperBrain's config.

### Verification

- [ ] `curl localhost:19520/api/health` returns status
- [ ] `/api/notebooks` returns all notebooks
- [ ] `/api/search` performs RAG search across notebooks
- [ ] `/api/notebooks/:id/chat` returns chat history
- [ ] Authentication works when token is set
- [ ] Server stops cleanly on app quit
- [ ] SuperBrain can query DeepNote during cognitive cycles

### What This Enables

| Consumer | Use Case |
|----------|----------|
| **SuperBrain** | Polls `/api/notebooks` + `/api/search` during cognitive cycles to incorporate notebook knowledge |
| **Shell / CLI** | `curl localhost:19520/api/search -d '{"query":"react hooks"}'` |
| **Raycast / Alfred** | Instant search across all notebooks via HTTP |
| **Claude Code** | Access research context: "What's in my DeepNote about X?" |
| **Automation** | Zapier/n8n/Shortcuts can read/write to DeepNote |
| **Other apps** | Any local tool can query your structured knowledge |

---

## Phase 3: Enhanced Chat with System-Wide Context

**Goal**: Chat responses draw on SuperBrain's memories and file index in addition to notebook-specific RAG.

**Estimated effort**: 1 day

### 3.1 Inject SuperBrain Context into Chat

**Modified file**: `src/main/ipc/chat.ts`

In the `CHAT_SEND` handler, after RAG retrieval:

```typescript
// Existing: notebook RAG context
const ragResult = await ragService.query(...)

// NEW: SuperBrain system-wide context
let systemContext = ''
if (superbrainService.isAvailable()) {
  const recalled = await superbrainService.recall(args.message, 5)
  if (recalled.length > 0) {
    systemContext = recalled
      .map(r => `[System Memory (${r.memoryType})] ${r.content}`)
      .join('\n\n')
  }
}

// Combine both contexts
const fullContext = [ragResult.context, systemContext]
  .filter(Boolean)
  .join('\n\n--- System-wide context ---\n\n')
```

### 3.2 Auto-Remember Chat Insights

**Modified file**: `src/main/ipc/chat.ts`

After saving assistant response, fire-and-forget:

```typescript
// Store key interaction in SuperBrain as episodic memory
superbrainService.remember(
  `Q: ${args.message}\nA: ${responseText.slice(0, 500)}`,
  'episodic',
  0.5
).catch(() => {})
```

### 3.3 Inject SuperBrain Context into Voice

**Modified file**: `src/main/services/voiceSession.ts`

Add SuperBrain recall results to the voice session's system instruction, so the voice AI has system-wide context.

### Verification

- [ ] Chat responses reference system-wide memories when relevant
- [ ] Voice AI mentions system-wide context
- [ ] Chat interactions are stored as SuperBrain memories
- [ ] Works normally when SuperBrain is offline

---

## Phase 4: System-Wide Search UI

**Goal**: Add a "System Search" capability to DeepNote that searches across files, emails, and memories.

**Estimated effort**: 2 days

### 4.1 System Search Panel

**New file**: `src/renderer/src/components/search/SystemSearchPanel.tsx` (~250 lines)

A new panel accessible from the sidebar or via keyboard shortcut (Cmd+Shift+F):

```
┌──────────────────────────────────────────┐
│ 🔍 System Search                         │
│ ┌──────────────────────────────────────┐ │
│ │ Search across your entire Mac...     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Filters: [All] [Files] [Memories] [Email]│
│                                          │
│ ── Files ──────────────────────────────  │
│ 📄 report-q4.pdf  (92% match)           │
│    "...quarterly revenue exceeded..."    │
│    ~/Documents/Reports/                  │
│                                          │
│ ── Memories ───────────────────────────  │
│ 🧠 Episodic (87% match)                 │
│    "User asked about Q4 budget..."       │
│                                          │
│ ── Emails ─────────────────────────────  │
│ 📧 RE: Q4 Budget Review (74% match)     │
│    ~/Library/Mail/...                    │
│                                          │
│ [Add to current notebook as source]      │
└──────────────────────────────────────────┘
```

Features:
- Unified search across SuperBrain files, memories, and Spotlight
- Filter tabs (All / Files / Memories / Emails)
- Click result to preview content
- "Add to notebook" button to import any result as a source
- Results grouped by type with similarity scores

### 4.2 Spotlight Search Integration

**Modified file**: `src/main/ipc/superbrain.ts`

Note: Spotlight search is a Tauri IPC command, not a REST endpoint. Two approaches:

**Option A**: Add a REST endpoint to SuperBrain for Spotlight (requires modifying SuperBrain)
**Option B**: Use macOS `mdfind` command directly from DeepNote's main process

Recommended: **Option B** (no SuperBrain changes needed)

```typescript
// src/main/services/spotlight.ts
import { execFile } from 'child_process'

async function spotlightSearch(query: string, kind?: string, limit = 10) {
  // mdfind -name "query" -onlyin ~ | head -n limit
  // For emails: mdfind 'kMDItemContentType == "com.apple.mail.emlx"' ...
}
```

### 4.3 Add to Sidebar Navigation

**Modified file**: `src/renderer/src/components/layout/Sidebar.tsx`

Add "System Search" icon/link (only shown when SuperBrain is connected).

### Verification

- [ ] System search returns results from files, memories, and emails
- [ ] Filter tabs work correctly
- [ ] Results can be added as notebook sources
- [ ] Panel hides gracefully when SuperBrain is offline

---

## Phase 5: Clipboard Intelligence

**Goal**: Surface clipboard history in the chat interface and allow clipboard-as-context.

**Estimated effort**: 0.5 days

### 5.1 Clipboard Context Chip

**Modified file**: `src/renderer/src/components/chat/ChatPanel.tsx`

Add a "Clipboard" chip above the chat input (next to artifact shortcuts):

```
[📋 Clipboard ▾]
```

Clicking shows a dropdown with the last 5 clipboard entries. Selecting one inserts it as context in the chat input or sends it as a message.

### 5.2 Voice Clipboard Command

**Modified file**: `src/main/services/voiceSession.ts`

Add clipboard context to the voice system instruction:

```typescript
if (superbrainAvailable) {
  const clipboard = await superbrainService.getClipboardHistory(3)
  systemInstruction += `\n\nRecent clipboard contents:\n${
    clipboard.map(c => `- "${c.content.slice(0, 200)}"`).join('\n')
  }`
}
```

### 5.3 "Use Clipboard" Chat Command

Users can type `/clipboard` in chat to insert recent clipboard as context. Alternatively, the AI can reference clipboard when asked "what did I copy?" or "use my clipboard."

### Verification

- [ ] Clipboard chip shows recent entries
- [ ] Selecting a clipboard entry adds it to chat
- [ ] Voice AI can reference clipboard contents
- [ ] Works without SuperBrain (chip just doesn't appear)

---

## Phase 6: Auto-Remember and Learn

**Goal**: DeepNote automatically stores valuable content in SuperBrain's long-term memory.

**Estimated effort**: 0.5 days

### 6.1 Auto-Remember Studio Generations

**Modified file**: `src/main/ipc/studio.ts`

After any studio content is generated, store a summary in SuperBrain:

```typescript
// After generating a report/quiz/flashcards/etc.
superbrainService.remember(
  `Generated ${type} "${title}" from notebook "${notebookTitle}". Key topics: ${topicSummary}`,
  'episodic',
  0.7
).catch(() => {})
```

### 6.2 Auto-Remember Source Ingestion

**Modified file**: `src/main/services/sourceIngestion.ts`

When a new source is ingested, remember it:

```typescript
superbrainService.remember(
  `Ingested source "${title}" (${type}) into notebook "${notebookTitle}". Content: ${content.slice(0, 500)}`,
  'semantic',
  0.6
).catch(() => {})
```

### 6.3 Auto-Remember Deep Research

**Modified file**: `src/main/services/deepResearch.ts`

Store research findings as high-importance semantic memories.

### Verification

- [ ] Studio generations appear in SuperBrain memories
- [ ] Source ingestions create SuperBrain memories
- [ ] Deep research findings are stored
- [ ] All auto-remembers are fire-and-forget (no blocking)

---

## Phase 7: Ollama Integration

**Goal**: Use locally running Ollama models for operations that don't need Gemini's quality.

**Estimated effort**: 1 day

### 7.1 Ollama Service

**New file**: `src/main/services/ollama.ts` (~100 lines)

```typescript
class OllamaService {
  private baseUrl = 'http://localhost:11434'

  async isAvailable(): Promise<boolean>
  async listModels(): Promise<string[]>
  async generate(prompt: string, model?: string): Promise<string>
  async embed(text: string, model?: string): Promise<number[]>
}
```

### 7.2 Tiered AI Strategy

**Modified file**: `src/main/services/ai.ts`

Route operations to the most appropriate provider:

| Operation | Primary | Fallback |
|-----------|---------|----------|
| Chat (complex) | Gemini | Ollama |
| Chat (simple) | Ollama | Gemini |
| Embeddings | ONNX (via SuperBrain) | Gemini |
| Content generation | Gemini | — |
| Memory extraction | Ollama | Gemini |
| Source guide | Ollama | Gemini |

### 7.3 Settings UI

**Modified file**: `src/renderer/src/components/common/SettingsModal.tsx`

Add Ollama section:
- Connection status
- Available models list
- Model selection for different operations
- "Check Ollama" button

### Verification

- [ ] Ollama status shows in settings
- [ ] Simple chat queries use Ollama when available
- [ ] Embeddings fall back through ONNX → Ollama → Gemini
- [ ] Works normally when Ollama is not installed

---

## Phase 8: Proactive Context Suggestions

**Goal**: DeepNote proactively suggests related content from SuperBrain when relevant.

**Estimated effort**: 1 day

### 8.1 Related Memories Sidebar

**Modified file**: `src/renderer/src/components/chat/ChatPanel.tsx`

When a chat response mentions topics that match SuperBrain memories, show a subtle "Related from your system" panel:

```
┌─ Related from your system ──────────────┐
│ 📄 Similar topic in ~/Documents/ML/...  │
│ 🧠 You discussed this on Feb 10         │
│ 📧 Email from Sarah about this          │
│                            [Dismiss]     │
└──────────────────────────────────────────┘
```

### 8.2 Source Suggestion on Notebook Open

When opening a notebook, check SuperBrain for recently indexed files that are semantically related to the notebook's topic. Suggest them as potential sources.

### 8.3 Cross-Notebook Recommendations

Use SuperBrain's memory to suggest related content from other notebooks:
- "Your 'ML Papers' notebook has 3 sources related to this topic"
- Show when browsing sources or in the empty chat state

### Verification

- [ ] Related memories appear after chat responses
- [ ] Source suggestions appear on notebook open
- [ ] Cross-notebook recommendations work
- [ ] All suggestions are dismissible and non-intrusive

---

## Implementation Timeline

```
Week 1:  Phase 1 (Bridge Service) + Phase 2 (DeepNote REST API)
Week 2:  Phase 3 (Enhanced Chat) + Phase 4 (System Search UI)
Week 3:  Phase 5 (Clipboard) + Phase 6 (Auto-Remember)
Week 4:  Phase 7 (Ollama) + Phase 8 (Proactive Suggestions)
```

---

## File Summary

### New Files

| File | Phase | Lines | Purpose |
|------|-------|-------|---------|
| `src/main/services/superbrain.ts` | 1 | ~200 | HTTP client for SuperBrain API |
| `src/main/ipc/superbrain.ts` | 1 | ~80 | IPC handlers for SuperBrain |
| `src/main/services/deepnoteApi.ts` | 2 | ~250 | DeepNote REST API server (bidirectional) |
| `src/renderer/src/components/search/SystemSearchPanel.tsx` | 4 | ~250 | System-wide search UI |
| `src/main/services/spotlight.ts` | 4 | ~60 | macOS Spotlight via mdfind |
| `src/main/services/ollama.ts` | 7 | ~100 | Ollama HTTP client |

### Modified Files

| File | Phases | Changes |
|------|--------|---------|
| `src/shared/types/index.ts` | 1 | SuperBrain type definitions |
| `src/shared/types/ipc.ts` | 1 | New IPC channel definitions |
| `src/preload/index.ts` | 1 | 7 new API bridge methods |
| `src/main/index.ts` | 1, 2 | Register SuperBrain handlers, start DeepNote API server |
| `src/renderer/src/components/common/SettingsModal.tsx` | 1, 2, 7 | SuperBrain + DeepNote API + Ollama settings |
| `src/main/ipc/chat.ts` | 3, 6 | Inject SuperBrain context, auto-remember |
| `src/main/services/voiceSession.ts` | 3, 5 | System-wide + clipboard context in voice |
| `src/renderer/src/components/chat/ChatPanel.tsx` | 5, 8 | Clipboard chip, related memories |
| `src/main/ipc/studio.ts` | 6 | Auto-remember generations |
| `src/main/services/sourceIngestion.ts` | 6 | Auto-remember source ingestion |
| `src/main/services/ai.ts` | 7 | Tiered AI provider routing |
| `src/renderer/src/components/layout/Sidebar.tsx` | 4 | System search link |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| SuperBrain not running | No system-wide features | Graceful degradation — all SuperBrain features are optional |
| API port conflict | Can't connect | Configurable ports in settings (19519 + 19520) |
| Embedding dimension mismatch (384 vs 768) | Search quality varies | Keep separate search paths; don't mix vectors |
| Ollama not installed | No local LLM | Fall back to Gemini API (existing behavior) |
| Performance impact of dual search | Slower chat responses | 2s timeout on SuperBrain calls; parallel with RAG |
| SuperBrain API changes | Breaking integration | Version check on `/api/status`; pin to known API contract |
| DeepNote API security | Unauthorized local access | Optional Bearer token auth; localhost-only binding |
| Data exposure via API | Sensitive notebook content accessible | Privacy toggle to exclude specific notebooks from API |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Chat response time with SuperBrain | < 5s (including dual context retrieval) |
| System search latency | < 2s for combined file + memory + Spotlight results |
| Auto-remember success rate | > 95% (fire-and-forget, failures are silent) |
| Graceful degradation | 100% — DeepNote works identically when SuperBrain is offline |
| Memory growth rate | ~10-50 memories/day with normal usage |
| DeepNote API response time | < 200ms for all endpoints |
| Bidirectional sync latency | < 5min (SuperBrain cognitive cycle interval) |

---

## Definition of Done

Each phase is complete when:
1. `npm run typecheck` passes
2. `npm run build` succeeds
3. Feature works with SuperBrain running
4. Feature degrades gracefully with SuperBrain offline
5. No regressions in existing notebook functionality
6. Committed and pushed to main
