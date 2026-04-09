# DeepNote AI — Product Document

**Version 1.4.0** | Desktop App for macOS, Windows, Linux
**Built with** Electron + React + TypeScript

---

## What Is DeepNote AI?

DeepNote AI is a desktop application that turns your documents, research, and files into actionable knowledge. Upload any combination of PDFs, websites, audio, spreadsheets, or plain text — then chat with your sources, generate presentations, create reports, and build a personal knowledge base that grows with every session.

Think of it as a local-first research workstation: your data stays on your machine, your AI provider keys are yours, and everything is searchable across notebooks.

---

## Core Features

### 1. Notebooks

The fundamental unit. Each notebook is a container for sources, notes, chat conversations, and generated content.

- **Create notebooks** with emoji icons, titles, and descriptions
- **Customize cards** with gradient colors or cover images
- **Export** entire notebooks as JSON or HTML
- **Link a workspace folder** for integrated file access
- **Chat mode** and **response length** preferences per notebook

---

### 2. Sources — 12 Input Types

Add anything as a source. Each source is chunked, embedded, and made searchable for chat and generation.

| Source Type | Details |
|-------------|---------|
| **PDF** | Page-number tracking in chunks for citations |
| **DOCX** | Word documents via mammoth parser |
| **PPTX** | PowerPoint slide extraction |
| **XLSX / CSV** | Spreadsheets with structured data |
| **Markdown / TXT** | Plain text files |
| **URL** | Web page scraping |
| **YouTube** | Transcript extraction from video URLs |
| **Audio** | MP3, WAV, M4A, OGG, FLAC — transcribed via Gemini |
| **Image** | PNG, JPG — described via Gemini vision |
| **Paste** | Raw text input |

Sources can be toggled on/off to control which material is used for chat context and content generation. Each source gets an auto-generated 3-4 sentence guide summary.

---

### 3. Multi-Provider Chat

Chat with your sources using your preferred AI provider. Streaming responses with source citations.

**Supported Providers:**
- **Google Gemini** — gemini-3-flash, gemini-3-pro, gemini-2.5-flash/pro
- **Anthropic Claude** — claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5
- **OpenAI** — gpt-4o, gpt-4o-mini
- **Groq** — llama-3.3-70b-versatile

**Chat Capabilities:**
- Streaming responses with real-time chunk rendering
- Source citations with page numbers (clickable)
- Knowledge Store search results inline
- File upload directly in chat (drag-and-drop or picker)
- 6 interactive artifact types generated inline:
  - **Tables** — sortable data tables
  - **Charts** — bar, line, pie (recharts)
  - **Diagrams** — Mermaid flowcharts, sequence, ER, Gantt, state diagrams
  - **Kanban boards** — task cards with status, priority, assignee
  - **KPI cards** — metric gauges with sentiment indicators
  - **Timelines** — horizontal scrollable event timelines

---

### 4. Notes — Obsidian-Class Knowledge Management

A full-featured knowledge management system with rich editing, organization, and AI-powered features.

**Rich Editor (Tiptap)**
- Full formatting toolbar: headings (H1-H3), bold, italic, strikethrough, highlight, super/subscript
- Task lists with checkboxes, bullet/ordered lists, blockquotes
- Code blocks with syntax highlighting (via lowlight), inline code
- Tables (resizable), images, links, horizontal rules
- Auto-save with debouncing, backward compat for plain text notes

**Organization**
- **Folders** — nested folder hierarchy with drag-and-drop, context menus
- **FTS5 Search** — full-text search across all notes using SQLite FTS5 with auto-sync triggers
- **Outline Panel** — table of contents from headings, click to scroll
- **Tags** — auto-extracted #hashtags, tag browser with counts, nested tags
- **Wiki Links** — `[[Note Title]]` linking with backlink panel and link resolution
- **Quick Switcher** — Cmd+O fuzzy note finder
- **Command Palette** — Cmd+P access to all views and actions

**Daily Notes & Templates**
- One-click daily note creation with date-based templates
- Three built-in templates: Daily Note, Meeting Notes, Research Note
- Custom templates with {{date}} and {{title}} placeholders

**Convert to Source** — feed notes back into the AI context for chat and studio

---

### 4a. Knowledge Graph

Interactive force-directed graph visualization of all notes and their connections.

- **Global graph** — all notes as nodes, [[wiki links]] as edges
- **Visual clustering** — force-directed layout groups related notes
- **Tag coloring** — nodes color-coded by their first tag
- **Interaction** — zoom, pan, drag nodes, hover for details, double-click to navigate
- **Sizing** — node size scales with connection count

---

### 4b. Knowledge Wiki (Karpathy Concept)

AI-maintained persistent knowledge pages, inspired by Andrej Karpathy's LLM Wiki architecture. Instead of re-discovering knowledge from raw documents on every query, the AI builds and maintains a structured wiki.

- **AI Ingest Pipeline** — add sources → AI generates entity, concept, topic, comparison, overview, and source-summary pages
- **Coverage Indicators** — high/medium/low badges based on number of contributing sources
- **Confidence Scores** — 0-100% per page, reflecting evidence strength
- **Cross-References** — AI maintains links between related wiki pages
- **Lint Engine** — detects orphan pages, low coverage, unlinked pages
- **Activity Log** — chronological record of ingests, updates, and maintenance
- **Six page types:** Entity, Concept, Topic, Comparison, Overview, Source Summary

---

### 4c. Tasks

Vault-wide task management extracted from note checkboxes.

- **Auto-extraction** — `- [ ]` and `- [x]` tasks automatically synced from notes
- **Due dates** — add `due:YYYY-MM-DD` to set deadlines
- **Priority** — `!high`, `!medium`, `!low` markers with color indicators
- **Filters** — All, Incomplete, Completed, Overdue, Today; filter by priority
- **Two-way sync** — toggle tasks in the Tasks panel, note content updates automatically
- **Source linking** — click source note title to navigate

---

### 4d. Kanban Board

Tag-based kanban board for visual note organization.

- **Auto-columns** — one column per tag, "Inbox" for untagged notes
- **Drag-and-drop** — move cards between columns to change tags
- **Custom columns** — add new tag-based columns on the fly
- **Card preview** — title + content snippet + tag badges

---

### 4e. Canvas (tldraw)

Infinite spatial workspace for freeform visual thinking.

- **Full tldraw toolkit** — shapes, text, arrows, freehand drawing, sticky notes, images, connectors
- **Multiple canvases** — create and manage multiple canvases per notebook
- **Auto-save** — changes persist every second
- **Snapshot storage** — canvas state saved as JSON in SQLite

---

### 4f. AI-Powered Note Features

AI assistance built into the note editor.

- **Auto-Tag Suggestions** — AI analyzes content and suggests 3-5 relevant hashtags
- **Auto-Link Suggestions** — finds mentions of other notes not yet wrapped in [[wiki links]]
- **Note Summarization** — generate short (1-2 sentences), medium (paragraph), or long (3-4 paragraphs) summaries
- **Toggle panel** — sparkle icon in editor header opens/closes the AI features sidebar

---

### 5. Workspace — Local Folder Integration

Link any folder on your machine to a notebook. Browse, edit, and sync files without leaving the app.

- **File tree browser** — hierarchical folder/file navigation with type icons
- **Integrated editor** — syntax highlighting, read/write files
- **AI Rewrite** — select text, give an instruction, get AI-rewritten output
- **Diff detection** — see which files were added, modified, or deleted since last sync
- **Sync banner** — alerts when workspace changes are pending
- **File selection** — pick specific files to include as chat context
- **CRUD operations** — create files, directories, delete files from within the app
- **.gitignore support** — respects your ignore rules

---

### 6. Knowledge Hub — Personal Knowledge Base

A persistent, cross-notebook knowledge store that grows over time. Your personal semantic search engine.

**Four tabs:**

| Tab | Purpose |
|-----|---------|
| **Overview** | Statistics, enable/disable, total items by type |
| **Knowledge** | Browse and search indexed items with similarity scoring |
| **Connectors** | Add local folders for automatic file ingestion and indexing |
| **Graph** | Network visualization of content relationships (nodes + edges) |

**Capabilities:**
- Semantic search across all indexed content
- Folder connectors — point at directories, auto-scan and index files
- Knowledge graph visualization with topic clusters and edge weights
- Automatic integration into chat — knowledge results appear inline when relevant
- Tiered embedding system:
  1. Local ONNX model (all-MiniLM-L6-v2, runs on-device)
  2. Gemini API embeddings (text-embedding-004)
  3. Hash fallback for exact matching

---

### 7. Studio — 15 Content Generation Tools

Generate professional content from your notebook's sources. Each tool has customization options.

#### Presentations & Visuals

| Tool | Description |
|------|-------------|
| **Image Slides** | AI-generated infographic-style slide decks. 6 style presets + custom color builder, 3 image models, 5 aspect ratios (including portrait), full-image and hybrid render modes. Per-slide revision with AI. Fullscreen presenter. PDF export. |
| **HTML Presentations** | Structured slide decks with 7 layout types. Per-slide regeneration, drag-and-drop reordering, AI image generation per block. PPTX export with embedded images. |
| **Infographic** | Single-page visual graphics in 3 formats (infographic, advertisement, social post). Custom color palettes. Veo 3.1 video animation (4-8 second clips, up to 4K). |
| **White Paper** | Multi-section professional documents with AI-generated cover and section illustrations. 3 tones (academic/business/technical), 3 lengths. A4 PDF export with references. |

#### Analysis & Research

| Tool | Description |
|------|-------------|
| **Report** | Data-driven analytical documents with smart format suggestions (Data Summary, Trends Analysis, Executive Summary, etc.) |
| **Literature Review** | Academic-style reviews with theme analysis, source citations, methodology comparisons, research gaps. |
| **Competitive Analysis** | Feature comparison matrices with multi-competitor scoring, weighting, and strengths/weaknesses. |
| **Document Diff** | Clause-by-clause comparison of two sources with change tracking (added/removed/changed) and significance commentary. |
| **Citation Graph** | Network visualization of relationships between your sources — shared topics, connection strength. |

#### Study & Data

| Tool | Description |
|------|-------------|
| **Flashcards** | Q&A study cards with flip animation. Adjustable count and difficulty. |
| **Quiz** | Multiple-choice questions with scoring, explanations, and correct answer tracking. |
| **Mind Map** | Interactive concept hierarchy (XYFlow). Configurable depth, branch count, and style. |
| **Data Table** | Structured data extraction with auto-generated headers and sortable rows. |
| **Dashboard** | KPI cards + charts + tables. Configurable metric count, chart types, and density. |

#### Audio

| Tool | Description |
|------|-------------|
| **Audio Overview** | Multi-speaker AI podcast. 4 formats: Deep Dive, Brief, Critical Analysis, Debate. Two TTS voices (Kore & Puck). WAV export. |

---

### 8. Voice Q&A

Real-time voice conversation with your notebook's sources.

- Start a voice session tied to a specific notebook
- Stream audio to AI, get spoken responses back
- Live transcript display
- Text-to-speech playback of AI responses
- Trigger artifact generation via voice commands

---

### 9. Deep Research

Multi-step analytical research with real-time progress tracking.

- Submit a research query against your notebook's sources
- AI performs iterative analysis with progress updates
- Results integrate into the chat interface

---

### 10. Global Search

**Cmd+K** — search across everything, from anywhere.

**Searches across:**
- Notebook titles and descriptions
- Source content (with similarity scoring)
- Notes (title and body)
- Workspace files (name and content)
- Knowledge Store memories
- System files (Spotlight integration on macOS)

Filter by category: All, Notebooks, Files, Memories.

---

### 11. Memory System

Cross-session memory that makes the AI smarter over time.

- **Automatic learning** — the AI remembers preferences, context, and feedback
- **Memory types:** preference, learning, context, feedback
- **Confidence scoring** — memories decay or strengthen over time
- **Per-notebook or global** — memories can be scoped to a notebook or shared
- **Injected into system prompts** — the AI uses memories to personalize responses
- **Manageable** — list, delete, or clear memories from Settings

---

### 12. Clipboard Quick-Capture

Capture content from your clipboard directly into a notebook.

- **System tray icon** — always accessible
- **Cmd+Shift+N** — global hotkey to capture
- **Clipboard history** — review recent items
- **Add to notebook** — paste as a new source with optional title

---

### 13. Source Recommendations

AI-powered discovery of related content across your notebooks.

- Select a source → get recommendations for similar content in other notebooks
- Based on semantic similarity scoring
- Helps connect research across projects

---

## AI Architecture

### Multi-Agent Pipeline
Content generation uses a research → write → review pipeline. If the reviewer scores output below 6/10, it triggers automatic revision.

### Agentic RAG
Chat queries are expanded into multiple sub-queries by AI, each retrieving different chunks from sources, then synthesized into a comprehensive response.

### Output Validation
JSON outputs go through validation middleware with up to 3 retry attempts to ensure valid, parseable results.

### Token Usage Tracking
Every AI call is tracked with input/output token counts, cost estimates, provider/model breakdown, and feature attribution. Viewable in Settings with reset capability.

---

## Export Formats

| Content | Export Options |
|---------|---------------|
| Notebooks | JSON, HTML |
| Image Slides | PNG (per slide), PDF (full deck with text overlays) |
| HTML Presentations | HTML file, PPTX with embedded images |
| White Papers | A4 PDF with cover + section images |
| Infographics | PNG, animated video (Veo 3.1) |
| Audio | WAV |
| Reports | Copy to clipboard |

---

## Configuration

Managed via Settings (gear icon in header):

- **API Keys** — Gemini (primary), Claude, OpenAI, Groq — with test/save/clear
- **Chat Provider & Model** — switch between providers and models
- **Embeddings** — auto, Gemini API, or local ONNX
- **Knowledge Store** — enable/disable
- **Dark Mode** — toggle in header
- **Token Usage** — view and reset usage statistics

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd+K** | Global search |
| **Cmd+P** | Command palette |
| **Cmd+O** | Quick notebook switcher |
| **Cmd+Shift+N** | Clipboard quick-capture |
| **Cmd+Shift+F** | File search |
| Arrow keys | Navigate slides in presenter mode |
| Escape | Exit fullscreen/modal |

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Desktop framework | Electron |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS |
| Rich text | Tiptap editor |
| Charts | Recharts |
| Diagrams | Mermaid + XYFlow |
| Database | SQLite via Drizzle ORM |
| Embeddings | ONNX Runtime (local) + Gemini API |
| Vector search | Custom vector store with HNSW-like indexing |
| Image generation | Google Imagen (Nano Banana models) |
| Video generation | Google Veo 3.1 |
| TTS | Gemini TTS (multi-voice) |
| Build | electron-vite |

---

*DeepNote AI — Your research, your data, your machine.*
