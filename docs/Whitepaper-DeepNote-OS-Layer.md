# DeepNote AI: From Notebook to Cognitive Operating Layer

**Whitepaper v1.1 — February 2026**

---

## Abstract

DeepNote AI began as an intelligent notebook application — a local-first platform for document ingestion, RAG-powered chat, and multi-format content generation. This whitepaper presents the next evolution: transforming DeepNote AI from a per-notebook tool into a **cognitive operating layer** for macOS. By integrating with SuperBrain, a high-performance Rust-based cognitive engine, DeepNote AI gains system-wide semantic memory, filesystem indexing, clipboard awareness, email access, Spotlight integration, and local LLM inference — while preserving its rich notebook UI as the primary interaction surface.

Critically, this integration is **bidirectional**: DeepNote AI draws on SuperBrain's system-wide knowledge, and SuperBrain learns from DeepNote's notebooks, conversations, and generated content. DeepNote exposes its own local REST API, making its structured knowledge accessible to SuperBrain, shell scripts, Raycast, Alfred, and any other tool in the ecosystem.

The result is a system where your entire Mac becomes a searchable, queryable, AI-augmented knowledge base — and DeepNote AI is both a window into that ecosystem and a knowledge provider to it.

---

## 1. The Problem: Isolated Knowledge

Today's AI-powered productivity tools share a fundamental limitation: **knowledge isolation**. Each application operates in its own silo:

- **Notebook apps** only know about documents you manually upload
- **AI assistants** have no memory between sessions and no awareness of your local files
- **Search tools** find filenames, not meaning
- **Email clients** are disconnected from your documents and notes

The user becomes the integration layer — manually copying context between apps, re-explaining preferences to AI assistants, and searching across multiple interfaces to find related information.

### The Cost of Isolation

| Scenario | Current Workflow | Steps |
|----------|-----------------|-------|
| "What did that email say about the Q4 budget?" | Open Mail, search, find email, read | 4 |
| "Find all my notes related to this PDF" | Open notebook, recall which notebook, search | 3-5 |
| "Generate a report using context from last week's research" | Find old chat, copy context, paste into new session | 5+ |
| "What was on my clipboard earlier about that API?" | Gone. You didn't save it. | N/A |

### What Users Actually Want

A single AI that knows everything you know — your files, your emails, your clipboard history, your past conversations — and can reason across all of it. Not another app. An **operating layer**.

---

## 2. Architecture: Two Systems, One Experience

Rather than rebuilding OS-level capabilities in JavaScript, DeepNote AI adopts a hybrid architecture that pairs each system's strengths:

```
                    ┌──────────────────────────────────────┐
                    │         DeepNote AI (Electron)        │
                    │                                      │
                    │  Notebooks  Chat  Voice  Studio      │
                    │  Sources    RAG   Notes  Artifacts   │
                    │                                      │
                    │  ┌──────────────────────────────┐    │
                    │  │  SuperBrain Bridge Service    │    │
                    │  │  HTTP client → localhost:19519│    │
                    │  └──────────────┬───────────────┘    │
                    │                 │                     │
                    │  ┌──────────────┴───────────────┐    │
                    │  │  DeepNote REST API            │    │
                    │  │  HTTP server ← localhost:19520│    │
                    │  └──────────────┬───────────────┘    │
                    └─────────────────┼────────────────────┘
                                      │
                          ┌───────────┴───────────┐
                          │  Bidirectional REST    │
                          │  :19519 ↔ :19520       │
                          └───────────┬───────────┘
                                      │
                    ┌─────────────────▼────────────────────┐
                    │       SuperBrain (Tauri + Rust)       │
                    │                                      │
                    │  Cognitive Engine    File Indexer     │
                    │  ONNX Embeddings    Clipboard Monitor│
                    │  Ollama / Claude    Spotlight Search  │
                    │  Q-Learning         Memory Decay     │
                    │  REST API (:19519)  Battery-Aware    │
                    │                                      │
                    │  ┌──────────────────────────────┐    │
                    │  │  DeepNote Bridge Client       │    │
                    │  │  HTTP client → localhost:19520│    │
                    │  └──────────────────────────────┘    │
                    └─────────────────┬────────────────────┘
                                      │
                    ┌─────────────────▼────────────────────┐
                    │            macOS Layer                │
                    │                                      │
                    │  Filesystem   Emails    Spotlight     │
                    │  Clipboard    Apps      Keychain      │
                    └──────────────────────────────────────┘
```

### Why Two Systems?

| Concern | DeepNote AI (Electron) | SuperBrain (Tauri + Rust) |
|---------|----------------------|--------------------------|
| **Purpose** | Rich UI, notebook management, content generation | OS-level services, high-performance compute |
| **Language** | TypeScript / React | Rust (Tokio async) |
| **Strength** | Beautiful, complex UIs; rapid iteration | Native performance; system access; SIMD |
| **Memory model** | Per-notebook SQLite | System-wide DashMap + SQLite |
| **Embeddings** | Gemini API (cloud) | ONNX local (384-dim, offline) |
| **Overhead** | ~300MB (Chromium) | ~15MB (native) |
| **API role** | Provides: notebooks, sources, chat, content | Provides: memory, files, clipboard, Spotlight |

The key insight: **both systems are knowledge providers**. SuperBrain provides system-wide OS context; DeepNote provides structured notebook knowledge. Each exposes a local REST API. Each consumes the other's. The user gets a single unified experience where both brains learn from each other.

---

## 3. The Cognitive Stack

### Layer 1: Sensing (SuperBrain)

SuperBrain continuously monitors the environment:

- **Clipboard** — Polls every 2 seconds, maintains last 50 entries
- **File system** — Watches configured directories, auto-reindexes on change
- **Spotlight** — Queries macOS metadata index for emails, documents, presentations
- **Battery** — Adapts cognitive cycle frequency (60s plugged, 300s on battery)

All sensing data is embedded using the ONNX model (`all-MiniLM-L6-v2`, 384 dimensions) and stored in the vector memory.

### Layer 2: Memory (SuperBrain)

Eight memory types model different kinds of knowledge:

| Type | Purpose | Example |
|------|---------|---------|
| **Semantic** | Facts and concepts | "React uses a virtual DOM" |
| **Episodic** | Events and experiences | "User asked about Q4 budget on Feb 12" |
| **Working** | Short-term, task-specific | Current clipboard contents |
| **Procedural** | How-to knowledge | "To export slides, click Studio > Export" |
| **Meta** | Self-reflection | "My responses about finance are more confident" |
| **Causal** | Cause-effect relationships | "Adding more sources improves quiz quality" |
| **Goal** | Objectives and targets | "User wants to finish the research report" |
| **Emotional** | Emotional associations | "User expressed frustration with PDF parsing" |

Memories decay over time unless reinforced by access. Importance scores (0-1) determine retention priority. The system consolidates memories during cognitive cycles, merging related entries and pruning low-value ones.

### Layer 3: Reasoning (DeepNote AI + SuperBrain)

When the user asks a question or requests content generation:

1. **DeepNote RAG** retrieves notebook-specific context from local embeddings
2. **SuperBrain Recall** retrieves system-wide context from cross-notebook and filesystem memories
3. **Combined context** is injected into the Gemini prompt
4. **Response** is generated with awareness of both notebook sources and system-wide knowledge
5. **Key insights** are stored back into SuperBrain as episodic memories

This creates a **learning loop**: every interaction enriches the system's knowledge, making future interactions more contextual and accurate.

### Layer 4: Learning (SuperBrain)

SuperBrain employs reinforcement learning to improve over time:

- **Q-Learning** — State-action value estimation for strategy selection
- **Experience Replay** — 10,000-entry buffer for batch training
- **Curiosity-Driven Exploration** — Seeks novel information when exploitation plateaus
- **Adaptive Strategy** — Automatically shifts between exploration and exploitation

The learning system tracks metrics like average reward, learning trend (improving/stable/declining), and thought confidence scores.

### Layer 5: Generation (DeepNote AI)

DeepNote AI's studio remains the content generation engine:

- **16 output types** — Reports, quizzes, flashcards, mind maps, slide decks, dashboards, podcasts, infographics, whitepapers, literature reviews, competitive analyses, and more
- **Multi-agent pipeline** — Research > Write > Review stages for complex content
- **AI middleware** — JSON validation, schema checking, automatic retry on malformed output
- **Voice Q&A** — Real-time bidirectional audio via Gemini Live API
- **In-chat artifacts** — Tables, charts, diagrams, kanban boards, KPIs, timelines

With SuperBrain integration, generation can draw on system-wide context — not just the sources uploaded to a single notebook.

### The Bidirectional Learning Loop

The most powerful aspect of this architecture is that **both systems teach each other**. Knowledge flows in both directions, creating a compounding intelligence effect:

```
┌─────────────────────────────────────────────────────────────────┐
│                   BIDIRECTIONAL KNOWLEDGE FLOW                   │
│                                                                  │
│  DeepNote AI → SuperBrain          SuperBrain → DeepNote AI      │
│  ─────────────────────────         ─────────────────────────     │
│                                                                  │
│  Chat insights → Episodic          System memories → Chat        │
│    memories                          context                     │
│                                                                  │
│  Generated content →               File index → Source           │
│    Semantic memories                 suggestions                 │
│                                                                  │
│  Source ingestion →                 Clipboard → Quick             │
│    Knowledge graph                   capture                     │
│                                                                  │
│  User preferences →                Emails/docs → Cross-          │
│    Learning patterns                 reference                   │
│                                                                  │
│  Research findings →               Learning trends →             │
│    High-value memories               Adaptive responses          │
│                                                                  │
│  Notebook structure →              Ollama inference →             │
│    Organizational context            Local AI fallback            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### DeepNote AI as a Knowledge Provider

DeepNote exposes its own REST API on `localhost:19520`, making its structured knowledge available to the entire local ecosystem:

| Endpoint | What It Exposes |
|----------|----------------|
| `GET /api/notebooks` | All notebooks with metadata and topic descriptions |
| `GET /api/notebooks/:id/sources` | Sources in a notebook with content summaries |
| `GET /api/notebooks/:id/chat` | Recent chat history (questions and AI answers) |
| `GET /api/notebooks/:id/content` | Generated content (reports, quizzes, mind maps, etc.) |
| `POST /api/search` | Semantic RAG search across all notebooks |
| `GET /api/notes` | All user-created and AI-generated notes |
| `GET /api/health` | DeepNote API status and notebook count |

This means:
- **SuperBrain** can query DeepNote during its cognitive cycles to incorporate notebook knowledge into its system-wide memory
- **Shell scripts** can query DeepNote: `curl localhost:19520/api/search -d '{"query":"machine learning"}'`
- **Raycast / Alfred** can search across all notebooks instantly
- **Other AI tools** (Claude Code, Cursor, etc.) can access your research context
- **Automation** can trigger content generation or retrieve past results

#### How SuperBrain Learns from DeepNote

During its cognitive cycles (every 60-300 seconds), SuperBrain can:

1. **Poll DeepNote's API** for recent chat messages and generated content
2. **Extract key facts** and store them as semantic memories
3. **Track user interests** from notebook topics and search patterns
4. **Cross-reference** notebook content with file index and email context
5. **Build a knowledge graph** that spans notebooks, files, emails, and clipboard

This creates a **flywheel effect**: the more you use DeepNote, the smarter SuperBrain becomes. The smarter SuperBrain becomes, the better context DeepNote provides. Every chat, every source upload, every generated report feeds back into the system-wide intelligence layer.

---

## 4. Key Capabilities

### 4.1 System-Wide Semantic Search

**Before**: Search within one notebook's uploaded sources.
**After**: Search across all notebooks, all indexed files, all emails, all documents on the Mac.

```
User: "What did I learn about transformer architectures?"

DeepNote searches:
  1. Current notebook sources (via RAG)
  2. SuperBrain memories (cross-session, cross-notebook)
  3. Indexed files (~/Documents, ~/Desktop, project folders)
  4. Spotlight results (emails, PDFs, presentations)

Result: Unified answer with citations from a PDF in ~/Research,
        an email from a colleague, and last week's chat session.
```

### 4.2 Cross-Session Memory

**Before**: Each chat session starts blank. The AI doesn't remember your preferences or past conversations.
**After**: The AI remembers your learning style, terminology preferences, past research threads, and frequently asked topics.

DeepNote's existing per-notebook memory system (Feature 4 in the current plan) is complemented by SuperBrain's global memory. Together they provide:

- **Notebook-level memory** — "This user prefers bullet-point summaries in this notebook"
- **Global memory** — "This user is a software engineer interested in AI/ML"
- **Cross-notebook recall** — "You researched a similar topic in your 'ML Papers' notebook"

### 4.3 Clipboard Intelligence

**Before**: Clipboard is ephemeral. Copy something, lose it when you copy again.
**After**: Last 50 clipboard entries are preserved and semantically searchable.

Use cases:
- "Use my clipboard as a source" — instantly add clipboard text to the current notebook
- "What did I copy earlier about React hooks?" — semantic search through clipboard history
- Voice command: "Remember what's on my clipboard" — stores as a working memory

### 4.4 Email and Document Awareness

**Before**: Emails live in Mail.app, completely disconnected from your research.
**After**: DeepNote can search emails via macOS Spotlight and incorporate them as context.

SuperBrain's `spotlight_search` command supports:
- **Emails** (`.emlx` / `.eml`) — RFC 822 parsing, headers + body extraction
- **Documents** (`.pdf`, `.docx`, `.txt`, `.md`)
- **Presentations** (`.pptx`, `.key`)
- **Images** (metadata search)

### 4.5 Local AI Inference

**Before**: All AI calls go to Google Gemini API (requires internet, costs money).
**After**: Ollama provides local LLM inference for many operations.

SuperBrain already integrates with Ollama and can check available models. With Ollama running locally:
- **Embeddings**: `nomic-embed-text` for free, offline vector search
- **Think**: Local LLMs (Llama 3.1, Mistral, etc.) for reasoning without API calls
- **Fallback**: Gemini API when local models are insufficient

### 4.6 Always-On Voice Assistant

DeepNote AI's existing Gemini Live voice (Feature 8, already implemented) combined with SuperBrain's system-wide context creates a voice assistant that:

- Knows your notebook contents (via RAG)
- Knows your file system (via SuperBrain file index)
- Knows your recent clipboard (via clipboard history)
- Knows your past conversations (via cross-session memory)
- Can trigger in-chat tools (table, chart, diagram, kanban, KPIs, timeline)
- Can reference studio tools for more complex generation

---

## 5. Privacy and Security

### Local-First Architecture

Both DeepNote AI and SuperBrain run entirely on the user's Mac:

- **Documents** never leave the machine (processed locally)
- **Embeddings** can be computed locally via ONNX (no API calls)
- **Memories** are stored in local SQLite databases
- **Clipboard** history stays on-device
- **API keys** are stored in macOS Keychain (not config files)

### External API Calls (Opt-In)

The only external network calls are:
- **Gemini API** — for chat, content generation, voice (user provides own API key)
- **Ollama** — runs locally on `localhost:11434` (no external network)

### Privacy Mode

SuperBrain includes a `privacy_mode` setting that, when enabled, disables clipboard monitoring and limits file indexing to explicitly selected folders.

---

## 6. Technical Specifications

### Performance Characteristics

| Operation | Engine | Latency |
|-----------|--------|---------|
| Vector similarity search (1K memories) | SuperBrain (SIMD) | <1ms |
| ONNX embedding generation | SuperBrain | ~5ms |
| Gemini embedding (API) | DeepNote | ~200ms |
| File chunk indexing (per file) | SuperBrain | ~50ms |
| Clipboard capture cycle | SuperBrain | 2s interval |
| Cognitive consolidation cycle | SuperBrain | 60-300s interval |
| Chat response (RAG + SuperBrain) | DeepNote | ~2-5s |
| Voice response (Gemini Live) | DeepNote | ~500ms |

### Storage Requirements

| Component | Size |
|-----------|------|
| SuperBrain binary | ~15MB |
| ONNX model (all-MiniLM-L6-v2) | ~23MB |
| ONNX tokenizer | ~0.7MB |
| SuperBrain SQLite DB (10K memories) | ~50MB |
| DeepNote AI app | ~300MB |
| DeepNote SQLite DB (per notebook) | ~5-50MB |

### Embedding Dimensions

| Provider | Dimensions | Quality | Speed | Offline |
|----------|-----------|---------|-------|---------|
| ONNX (all-MiniLM-L6-v2) | 384 | Good | 5ms | Yes |
| Ollama (nomic-embed-text) | 768 | Better | 20ms | Yes |
| Gemini (text-embedding-004) | 768 | Best | 200ms | No |

---

## 7. Competitive Landscape

| Product | Local Data | System-Wide | Learning | Generation | Voice | Offline |
|---------|-----------|-------------|----------|------------|-------|---------|
| **DeepNote AI + SuperBrain** | Full | Full | Yes | 16 types | Yes | Partial |
| NotebookLM (Google) | No | No | No | 2 types | No | No |
| Obsidian + AI plugins | Partial | No | No | Limited | No | Partial |
| Apple Intelligence | Partial | Partial | No | Limited | Siri | Yes |
| Notion AI | Cloud | No | No | Text only | No | No |
| Rewind.ai | Full | Screen capture | No | No | No | No |

DeepNote AI's unique position: **the only system that combines local-first privacy, system-wide OS integration, self-improving memory, multi-format content generation, and real-time voice — in a single desktop experience.**

---

## 8. Future Directions

### Phase 1: SuperBrain Integration (Current)
Connect DeepNote AI to SuperBrain's REST API for system-wide memory, file search, clipboard, and Spotlight access.

### Phase 2: Unified Embedding Space
Align ONNX (384-dim) and Gemini (768-dim) embeddings through a projection layer, enabling cross-system semantic search without re-embedding.

### Phase 3: App-Specific Adapters
Build adapters for specific macOS applications:
- **Calendar** — "What meetings do I have about this topic?"
- **Browser** — Index open tabs and bookmarks
- **Terminal** — Capture command history and output
- **IDE** — Integrate with VS Code / Xcode project context

### Phase 4: Proactive Intelligence
Move from reactive (user asks) to proactive (system suggests):
- "You have an email from Sarah about the same topic you're researching"
- "Your clipboard contains a code snippet related to this notebook"
- "Based on your learning pattern, here's a flashcard review"

### Phase 5: Multi-Device Sync
Extend the cognitive layer beyond a single Mac:
- Encrypted memory sync across devices
- Shared notebook collaboration
- Cloud-optional backup with end-to-end encryption

---

## 9. Conclusion

The transition from notebook application to cognitive operating layer represents a fundamental shift in how users interact with AI. Instead of bringing data to the AI, the AI comes to the data — wherever it lives on the system.

By combining DeepNote AI's rich notebook interface and content generation capabilities with SuperBrain's high-performance cognitive engine and OS-level integrations, we create something that neither system could achieve alone: **a personal AI that knows everything you know, learns from every interaction, and helps you create from the full breadth of your digital life.**

The notebook is no longer a container. It's a window into your entire knowledge ecosystem.

---

*DeepNote AI is developed by Clemens Hoenig. SuperBrain cognitive engine by rUv.*
*All data processing occurs locally. No document content is transmitted to external servers except when explicitly using cloud AI APIs.*
