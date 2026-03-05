# DeepNote AI — Product Document

**Version 1.2.2** | Desktop App for macOS, Windows, Linux
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

### 4. Notes & Editor

A built-in note-taking system with wiki-style linking and rich text editing.

- **Rich text editor** (Tiptap) — bold, italic, headings, code blocks, links, alignment
- **Auto-save** — changes persist immediately
- **Tag system** — tag notes and browse by tag cloud with counts
- **Backlinks** — wiki-style `[[Note Title]]` linking with backlink panel
- **Convert notes to sources** — feed your notes back into the AI context

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
