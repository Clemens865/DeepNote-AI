# DeepNote AI

> **Beta Release** — This is the first public beta. Expect rough edges, evolving APIs, and occasional AI generation failures. We welcome bug reports and feedback via [GitHub Issues](https://github.com/Clemens865/DeepNote-AI/issues).

A feature-rich, open-source desktop application inspired by Google's NotebookLM. Built with Electron, React, and powered by multi-provider AI (Gemini, Claude, OpenAI, Groq). Upload documents, chat with your sources, and generate studio-quality content — AI podcasts, image slide decks with a drag-and-drop editor, whitepapers, infographics, flashcards, quizzes, mind maps, dashboards, literature reviews, competitive analyses, reports, and more — with agentic RAG, multi-agent generation pipelines, voice Q&A, cross-session memory, DeepBrain system integration, and local embeddings.

<!-- TODO: Add hero screenshot -->

---

## Table of Contents

- [Features Overview](#features-overview)
- [What's New — Beta](#whats-new--beta)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Quick Install (macOS)](#quick-install-macos)
  - [Build from Source](#build-from-source)
  - [Configuration](#configuration)
  - [Running](#running)
  - [Building](#building)
- [Application Guide](#application-guide)
  - [Notebooks](#notebooks)
  - [Sources](#sources)
    - [Smart Source Recommendations](#smart-source-recommendations)
  - [Chat](#chat)
    - [Interactive Artifacts](#interactive-artifacts)
    - [Artifact Shortcut Chips](#artifact-shortcut-chips)
    - [Voice Q&A](#voice-qa)
    - [Chat-to-Source Pipeline](#chat-to-source-pipeline)
  - [Deep Research](#deep-research)
  - [Notes](#notes)
  - [Studio](#studio)
    - [Audio Overview](#audio-overview)
    - [Image Slide Deck](#image-slide-deck)
    - [Study Flashcards](#study-flashcards)
    - [Quiz](#quiz)
    - [Report](#report)
    - [Mind Map](#mind-map)
    - [Data Table](#data-table)
  - [Workspace (File Editor)](#workspace-file-editor)
- [AI Architecture](#ai-architecture)
  - [Agentic RAG](#agentic-rag)
  - [Multi-Agent Generation Pipeline](#multi-agent-generation-pipeline)
  - [AI Output Validation Middleware](#ai-output-validation-middleware)
  - [Cross-Session Memory](#cross-session-memory)
  - [Tiered Embeddings](#tiered-embeddings)
- [Clipboard Quick-Capture](#clipboard-quick-capture)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [License](#license)

---

## Features Overview

| Category | Features |
|----------|----------|
| **Source Ingestion** | PDF, DOCX, TXT, Markdown, Website URLs, YouTube transcripts, Audio files (MP3/WAV/M4A/OGG/FLAC), Paste text |
| **AI Chat** | Streaming responses, source-grounded citations, conversation history, suggested prompts, 6 interactive artifact types (Table, Chart, Mermaid, Kanban, KPI, Timeline), one-click artifact shortcut chips, voice Q&A |
| **Deep Research** | Multi-step AI analysis with real-time progress updates |
| **Audio Overview** | Multi-speaker AI podcast with 4 format styles (Deep Dive, Brief, Critical Analysis, Debate) |
| **Image Slides** | AI-generated slide decks with 6 visual styles + custom style builder, 3 image models (Nano Banana Pro / 2 / Classic), 2 render modes (full-image / hybrid editable), fullscreen presenter, rich text drag-and-drop editor, Save button with feedback, PDF export with text overlays |
| **White Paper** | AI-generated multi-section white papers with cover image, section illustrations, table of contents, references, 3 image models, and A4 PDF export |
| **Infographic** | AI-generated single-page infographics in full-image or hybrid mode with custom color palettes and 3 image model options |
| **Study Tools** | Flashcards, Quizzes (multiple choice), Reports, Mind Maps, Data Tables, Dashboards, Literature Reviews, Competitive Analyses, Document Comparisons, Citation Graphs — search/filter/sort for all generated content |
| **Notes** | Create, edit, auto-save notes; convert notes to sources for AI context |
| **Workspace** | Link local folders, file tree browser, text editor with AI rewrite, .gitignore support |
| **Export** | Download audio as WAV, slides as PNG, slide decks as PDF (with text overlays for hybrid mode), whitepapers as A4 PDF, copy reports to clipboard |
| **AI Architecture** | Agentic RAG (multi-query retrieval), multi-agent generation pipeline (Research → Write → Review), AI output validation with retry, cross-session memory |
| **Embeddings** | Tiered embedding system: local ONNX (all-MiniLM-L6-v2) → Gemini API → hash fallback |
| **DeepBrain** | System-wide memory recall, file search, email search, activity context — results shown as preview cards in chat |
| **Multi-Provider Chat** | Gemini (default), Claude, OpenAI, Groq — switch providers and models in Settings |
| **Productivity** | Clipboard quick-capture via system tray (Cmd+Shift+N), chat-to-source pipeline, smart source recommendations |

---

## What's New — Beta

This beta includes 15+ major features transforming DeepNote AI from a notebook tool into a full intelligent research platform:

| Feature | Description |
|---------|-------------|
| **15 Studio Tools** | Audio, Image Slides, Flashcards, Quiz, Report, Mind Map, Data Table, Dashboard, Literature Review, Competitive Analysis, Document Comparison, Citation Graph, Infographic, White Paper, and Deep Research |
| **White Paper Generator** | Multi-section academic/business/technical papers with cover images, section illustrations, ToC, references, and A4 PDF export |
| **Infographic Generator** | Full-image or hybrid infographics with 6 style presets + custom style builder with reference image analysis |
| **Hybrid Slide Editor** | Drag-and-drop text overlays on AI backgrounds, Save button with visual feedback, arrow key navigation respects text editing, PDF export includes text overlays |
| **Custom Style Builder** | Upload a reference image — the AI extracts and replicates its visual style for slides, infographics, and whitepapers |
| **Image Model Picker** | Choose between 3 Gemini image models per creation: Nano Banana Pro (highest fidelity), Nano Banana 2 (fast & efficient), Nano Banana (speed optimized) |
| **Glass Morphism UI** | Polished dark/light theme with frosted glass effects, refined modals, and fullscreen dialogs |
| **Agentic RAG** | Multi-query retrieval: AI generates 2-3 targeted sub-queries, deduplicates results, checks sufficiency |
| **Multi-Agent Pipeline** | Complex content goes through Research → Write → Review pipeline with automatic revision if quality < 6/10 |
| **AI Output Validation** | Middleware validates all JSON output, strips markdown fences, retries with error feedback (3 attempts) |
| **Cross-Session Memory** | AI remembers preferences and learning patterns per notebook with confidence scoring |
| **Voice Q&A** | Audio transcription → RAG chat → TTS response — speak to your sources |
| **Multi-Provider Chat** | Gemini, Claude, OpenAI, Groq — switch providers and models per conversation |
| **DeepBrain Integration** | System-wide memory, file search, email search, activity context — results as clickable preview cards |
| **Local ONNX Embeddings** | Offline embeddings via all-MiniLM-L6-v2 with tiered fallback (ONNX → Gemini → hash) |
| **Global Search** | System-wide search across all notebooks, sources, files, emails, and memories (Cmd+K) |
| **Clipboard Quick-Capture** | System tray icon + Cmd+Shift+N to capture clipboard content to your notebook |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Electron 39 via electron-vite |
| **Frontend** | React 19, TypeScript 5, Tailwind CSS v4 |
| **State** | Zustand |
| **Routing** | react-router-dom v7 |
| **Database** | SQLite (better-sqlite3 v12.6) + Drizzle ORM |
| **AI** | Google Gemini, Anthropic Claude, OpenAI, Groq (`@google/genai`, multi-provider) |
| **Local Embeddings** | ONNX Runtime (all-MiniLM-L6-v2, 384-dim) |
| **Rich Text** | Tiptap (ProseMirror-based) |
| **Drag & Drop** | react-draggable |
| **Document Parsing** | pdf-parse, mammoth (DOCX) |
| **Icons** | lucide-react |
| **Font** | Inter (bundled via @fontsource-variable) |

**AI Models Used:**
- `gemini-3-flash-preview` (default) / `gemini-3-pro-preview` / `gemini-2.5-flash` / `gemini-2.5-pro` — Chat, content generation, document analysis, agentic RAG
- `claude-sonnet-4-6` / `claude-opus-4-6` / `claude-haiku-4-5` — Claude chat providers
- `gpt-4o` / `gpt-4o-mini` — OpenAI chat providers
- `llama-3.3-70b-versatile` — Groq chat provider
- `gemini-2.5-flash-preview-tts` — Multi-speaker text-to-speech (Kore & Puck voices)
- `gemini-3-pro-image-preview` (Nano Banana Pro) / `gemini-3.1-flash-image-preview` (Nano Banana 2) / `gemini-2.5-flash-image` (Nano Banana) — AI image generation for slides, infographics, whitepapers — selectable per creation
- `text-embedding-004` — Text embeddings for RAG (Gemini cloud tier)
- `all-MiniLM-L6-v2` — Local ONNX embeddings (offline tier, 384-dim)

---

## Getting Started

### Quick Install (macOS)

1. Download the latest **DMG** from [Releases](https://github.com/Clemens865/DeepNote-AI/releases)
2. Open the DMG and drag **DeepNote AI** to your Applications folder
3. Launch the app, open **Settings** (gear icon), and enter your **Gemini API Key**
4. Click **Test** to verify, then **Save** — you're ready to go

> **Note:** The app is signed but not notarized. On first launch macOS may show a security warning — right-click the app and choose "Open" to bypass it.

### Build from Source

#### Prerequisites

- **Node.js** 20+ and npm
- **Google Gemini API Key** (free at [aistudio.google.com](https://aistudio.google.com/apikey))

#### Installation

```bash
# Clone the repository
git clone https://github.com/Clemens865/DeepNote-AI.git
cd DeepNote-AI

# Install dependencies (ignore scripts to avoid premature native builds)
npm install --ignore-scripts

# Rebuild native modules for Electron
npx @electron/rebuild -f -w better-sqlite3
```

### Configuration

1. Launch the app
2. Click the **Settings** icon (gear) in the header
3. Enter your **Gemini API Key**
4. Click **Test** to verify, then **Save**

The API key is stored locally and never leaves your machine (except to call the Gemini API).

### Running

```bash
# Development mode with hot reload
npm run dev

# Preview production build
npm run start
```

### Building

```bash
# Full build (typecheck + bundle)
npm run build

# Platform-specific distributables
npm run build:mac      # macOS .dmg
npm run build:win      # Windows .exe
npm run build:linux    # Linux .AppImage
```

---

## Application Guide

### Notebooks

The **Dashboard** is the home screen. Each notebook is an isolated workspace with its own sources, chat history, notes, and generated content.

- **Create** a notebook by clicking the "+" button - choose a title and icon
- **Workspace notebooks** can be linked to a local folder for file editing
- **Search** notebooks by title using the search bar
- **Delete** notebooks via the context menu

Each notebook displays the number of sources and the last-modified date.

---

### Sources

Sources are the knowledge base for your notebook. All AI features (chat, studio) draw from **selected** sources.

**Supported Source Types:**

| Type | Description |
|------|-------------|
| **File Upload** | PDF, DOCX, DOC, TXT, MD files |
| **Website** | Extracts text content from any URL |
| **YouTube** | Extracts transcript from YouTube video URLs via Gemini AI |
| **Audio** | Transcribes MP3, WAV, M4A, OGG, FLAC, AAC files via Gemini multimodal |
| **Paste Text** | Directly paste text content with a custom title |

**Source Features:**
- **Select / Deselect** - Toggle which sources provide AI context (checkbox per source)
- **Source Guide** - AI-generated summary overview of each source
- **Auto-chunking** - Documents are split into chunks with embeddings for RAG retrieval
- **Delete** sources individually

#### Smart Source Recommendations

When viewing a source, DeepNote AI can recommend related sources from your other notebooks using vector similarity search. This helps you discover connections between different areas of research.

---

### Chat

The **Chat Panel** is the main interaction mode. Ask questions and get AI-generated answers grounded in your selected sources.

- **Streaming responses** - Answers appear token-by-token in real time
- **Source citations** - Responses include `[Source N]` references linking to specific source chunks
- **Suggested prompts** - Quick-start buttons: "Summarize my sources", "Key takeaways", "Create a study guide"
- **Upload from chat** - Add new documents or audio files directly from the chat input
- **Save to Note** - Save any AI response as a note for later reference
- **Clear history** - Reset the conversation
- **Cross-session memory** - The AI remembers your preferences and learning patterns
- **DeepBrain integration** - When DeepBrain is running, the AI can search your system files, emails, and memories. Results appear as clickable preview cards below each response (file cards open in your default app)

**Interactive Artifacts:**

The AI can embed rich visualizations directly in its responses:

| Artifact | Description |
|----------|-------------|
| **Table** | Sortable data tables with columns and rows |
| **Chart** | Bar, line, or pie charts with tooltips and legend |
| **Mermaid Diagram** | Flowcharts, sequence diagrams, ER diagrams |
| **Kanban Board** | Task cards with assignee, priority, and status |
| **KPI Cards** | Metric cards with progress bars and sentiment colors |
| **Timeline** | Horizontal timeline with dated events |

**Artifact Shortcut Chips:**

Six quick-action buttons appear above the chat input (when sources are selected). Click any chip to instantly request that artifact type - Table, Chart, Diagram, Kanban, KPIs, or Timeline.

#### Voice Q&A

Click the **microphone button** next to the chat input to start a voice conversation with your sources.

- **Record** - Tap the mic button to start recording your question
- **Transcription** - Audio is transcribed via Gemini AI
- **RAG-powered response** - Your question is answered using selected source context
- **TTS playback** - The AI's response is spoken back to you
- **Transcript display** - Full text transcript of the conversation appears in the overlay
- **Multiple turns** - Continue asking follow-up questions in the same session

#### Chat-to-Source Pipeline

Every AI response has action buttons to integrate it into your workflow:

| Action | Description |
|--------|-------------|
| **Note** | Save the response as a note in your notebook |
| **Source** | Add the response as a new source (with full embedding ingestion) |
| **Workspace** | Write the response as a Markdown file to your workspace folder |
| **Generate** | Send the response to studio as context for content generation |
| **Copy** | Copy the response text to clipboard |

---

### Deep Research

Deep Research performs a multi-step, in-depth analysis of your sources. It goes beyond simple chat by running a longer AI pipeline with real-time progress updates.

- Click the **Deep Research** button in the chat panel
- Enter a research query
- Watch progress indicators as the AI analyzes sources in depth
- Results appear as a comprehensive research report in the chat

---

### Notes

The **Notes Panel** provides a scratchpad for your own thoughts alongside AI-generated content.

- **Create** notes with the "+" button
- **Auto-save** - Content saves automatically as you type (500ms debounce)
- **Editable titles** - Click any note title to rename it
- **Convert to Source** - Turn a note into a source document so the AI can reference it in chat and studio
- **Timestamps** - Each note shows when it was last edited
- **Delete** notes with confirmation

---

### Studio

The **Studio Panel** contains 15 AI-powered content generation tools. Each tool transforms your selected sources into a different output format.

All studio tools support:
- **Custom instructions** - Guide the AI's focus and audience
- **Length options** - Short, Default, or Long output
- **Rename** generated content
- **Delete** generated content
- **Generation history** - All past outputs are accessible
- **Search & filter** - Find generated items by title, filter by type, sort by newest/oldest/title/type
- **Multi-agent pipeline** - Complex types (report, whitepaper, literature review) use a Research → Write → Review pipeline with real-time progress indicators

---

#### Audio Overview

Generate a podcast-style audio conversation between two AI speakers discussing your source material.

**Format Options:**

| Format | Description |
|--------|-------------|
| **Deep Dive** | Comprehensive discussion covering all key topics |
| **Brief Overview** | Short, high-level summary |
| **Critical Analysis** | Examines strengths, weaknesses, and implications |
| **Debate** | Two speakers take opposing perspectives |

**Length Options:**
- Short: 8-12 conversational turns
- Default: 15-25 turns
- Long: 30-45 turns

**Audio Features:**
- Two distinct AI voices (Kore & Puck) via Gemini TTS
- Built-in audio player with play/pause/seek
- Full transcript view with color-coded speakers
- Download as WAV file

---

#### Image Slide Deck

The most advanced studio feature. Generates complete slide presentations with AI-created background images and editable text overlays.

**6 Visual Style Presets:**

| Style | Background | Accents | Aesthetic |
|-------|-----------|---------|-----------|
| **Blueprint Dark** | Dark teal | Orange & Cyan | Sci-fi command center, circuit diagrams |
| **Editorial Clean** | Cream | Orange & Blue | Magazine editorial, hand-drawn sketches |
| **Corporate Blue** | White | Navy & Light Blue | Boardroom professional, geometric icons |
| **Bold Minimal** | White | Black & Red | Apple keynote, large typography |
| **Nature Warm** | Cream | Green & Terracotta | Botanical, organic patterns |
| **Dark Luxe** | Black | Gold & White | Premium luxury, elegant lines |

**Custom Style** - Upload a reference image and the AI will extract and replicate its visual style.

**Image Model Selection:**

Each generation lets you choose between three Gemini image models:

| Model | Gemini ID | Best For |
|-------|-----------|----------|
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | Highest fidelity, advanced reasoning for complex prompts |
| **Nano Banana 2** | `gemini-3.1-flash-image-preview` | Fast & efficient, great for high-volume use |
| **Nano Banana** | `gemini-2.5-flash-image` | Speed optimized, lowest latency |

**Presentation Formats:**
- **Presentation** - Educational / informational slides
- **Pitch Deck** - Business pitch (Problem, Solution, Market, Ask)
- **Report Deck** - Data-driven analysis with charts

**Slide Count:** Test (3), Short (5), Default (10)

**Aspect Ratios:** 16:9 (widescreen), 4:3 (classic)

**Two Render Modes:**

| Mode | Description |
|------|-------------|
| **Full Image** | Text baked directly into the generated image |
| **Hybrid (Editable)** | AI background image + draggable HTML text overlays |

**Rich Slide Editor (Hybrid Mode):**

Click the pencil icon on any hybrid slide to enter edit mode:

- **Drag & Drop** - Freely position title, bullet, and text elements anywhere on the slide
- **Rich Text Formatting** - Bold, italic, underline, strikethrough via Tiptap editor
- **Bullet Lists** - Toggle bullet list formatting
- **Text Alignment** - Left, center, right alignment per element
- **Font Size** - Dropdown with sizes from 12px to 48px
- **Text Color** - 10-color palette picker
- **Links** - Add hyperlinks to text
- **Add Text Box** - Create new free-positioned text elements
- **Delete Elements** - Remove unwanted text boxes (minimum 1 must remain)
- **Resize** - Drag the corner handle to adjust element width
- **Auto-save** - All changes persist automatically (800ms debounce)
- **Save Button** - Explicit save with visual feedback (saving spinner → "Saved" checkmark)
- **Click outside** to deselect elements

**Presentation Features:**
- **Fullscreen Mode** - Press the expand button for a full-screen presentation
- **Keyboard Navigation** - Arrow keys and Space to advance slides (disabled while editing text to preserve cursor position)
- **Thumbnail Strip** - Visual slide navigator
- **Speaker Notes** - Show/hide AI-generated speaker notes per slide
- **Download** - Save individual slides as PNG files

<!-- TODO: Add slide deck screenshot -->

---

#### Study Flashcards

Generate interactive flashcards from your sources for study and review.

- **Card Count:** Fewer (5-8), Standard (10-20), More (25-35)
- **Difficulty:** Easy, Medium, Hard
- **Interactive** - Click cards to flip and reveal the answer
- **Source References** - Each card cites the relevant source

---

#### Quiz

Generate multiple-choice quizzes to test your understanding.

- **Question Count:** Fewer (3-5), Standard (5-10), More (12-20)
- **Difficulty:** Easy, Medium, Hard
- **4 options** per question
- **Interactive answer reveal** - Green for correct, red for incorrect
- **Explanations** - Each answer includes a "why this is correct" explanation

---

#### Report

Generate a structured written report from your sources.

- **Executive Summary** + 3-6 detailed sections
- **Custom focus** - Use instructions to target specific topics or audiences
- **Multi-agent pipeline** - Research → Write → Review for higher quality
- **Copy to clipboard** - One-click copy of the full report text

---

#### Mind Map

Generate a hierarchical mind map visualization of your source content.

- **3 levels deep** - Central topic, main branches, sub-branches
- **3-6 main branches** with 2-4 children each
- **Color-coded depth** - Indigo (root), Blue (L1), Emerald (L2), Amber (L3)
- **Expandable tree** - Click to expand/collapse branches

---

#### Data Table

Extract structured data from your sources into a sortable table.

- **5-15 rows** of meaningful data points
- **AI-optimized columns** - The AI determines the best column structure
- **HTML table display** with clean formatting

---

### Workspace (File Editor)

Link a local folder to your notebook and browse, edit, and AI-index files without leaving the app.

**File Tree:**
- **Hierarchical browser** - Navigate your project's file structure
- **.gitignore support** - Respects `.gitignore` patterns for file exclusion
- **Status indicators:**
  - Gray - Unindexed (not included in AI context)
  - Green - Indexed (included in AI context)
  - Yellow - Stale (file changed on disk since last index)
  - Red - Error during indexing
- **Select / Deselect files** - Control which files become AI sources

**File Editor:**
- **Text editing** - Edit any text file directly in the app
- **Dirty state indicator** - Orange dot when there are unsaved changes
- **Auto-detect read-only** - Binary/unsupported files open in read-only mode

**AI Rewrite:**
- Select text in the editor and press `Cmd/Ctrl + K`
- An inline popup appears near your selection
- Type an instruction (e.g., "Make it more concise", "Add error handling")
- The AI rewrites just the selected text in context of the full file
- One-click replace of the original selection

**Workspace Sync:**
- Detects file changes (added, modified, deleted) on disk
- Re-indexes stale files to keep AI context up to date
- Shows sync status banner with counts

---

## AI Architecture

DeepNote AI uses several advanced AI patterns under the hood to deliver high-quality results.

### Agentic RAG

Traditional RAG uses a single query to search for relevant context. DeepNote AI's **Agentic RAG** system reasons about your question first:

1. **Sub-query generation** - The AI generates 2-3 targeted search queries from your question
2. **Multi-query search** - Each sub-query is embedded and searched independently
3. **Deduplication & ranking** - Results are merged by chunk ID and ranked by combined score
4. **Sufficiency check** - The AI evaluates whether enough context was retrieved, and can request one additional retrieval round

This produces significantly better context for complex, multi-faceted questions.

### Multi-Agent Generation Pipeline

For complex studio content types (report, literature review, competitive analysis, dashboard, whitepaper), generation uses a three-stage pipeline:

| Stage | Role | Description |
|-------|------|-------------|
| **Research** | Analyst | Extracts key themes, facts, data points, and relationships from source material |
| **Write** | Writer | Generates structured content using research findings + source material |
| **Review** | Reviewer | Validates quality, checks structure, grades output (1-10). If score < 6, feeds back to writer for revision |

Real-time progress updates show which stage is currently executing.

### AI Output Validation Middleware

All AI-generated structured content passes through a validation middleware pipeline:

- **JSON validation** - Strips markdown fences, validates JSON parsing
- **Structure validation** - Per-type schema checks (quiz must have questions with options, flashcards must have front/back, etc.)
- **Retry with feedback** - On validation failure, the error message is appended to the prompt and the AI retries (up to 3 attempts)

### Cross-Session Memory

The AI learns from your conversations and remembers preferences across sessions:

- **Automatic extraction** - After each conversation, the AI extracts preferences, learning patterns, and context
- **Memory types** - Preference, learning, context, and feedback memories
- **Confidence scoring** - Each memory has a confidence score (0.0-1.0) that updates over time
- **Per-notebook + global** - Memories can be scoped to a specific notebook or applied globally
- **System prompt injection** - Relevant memories are automatically included in the AI's context

### Tiered Embeddings

DeepNote AI supports a tiered embedding system for flexibility between online and offline use:

| Tier | Model | Dimensions | Requirement |
|------|-------|-----------|-------------|
| **1. Local ONNX** | all-MiniLM-L6-v2 | 384 | Auto-downloads model (~80MB) |
| **2. Gemini API** | gemini-embedding-exp-03-07 | 768 | API key + internet |
| **3. Hash fallback** | Content hash | 768 | Always available |

The system automatically selects the best available tier. Configurable via Settings (`auto`, `gemini`, or `local`).

---

## Clipboard Quick-Capture

A **system tray icon** provides quick access to capture clipboard content without opening the main window.

- **Global shortcut** - Press `Cmd+Shift+N` from any app to capture clipboard text
- **Clipboard history** - Last 10 captured items stored in the tray menu
- **Add to notebook** - Send any captured text directly as a source to your current notebook
- **Always accessible** - Works even when the main window is minimized

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save file in workspace editor |
| `Cmd/Ctrl + K` | Open AI rewrite popup (with text selected) / Open global search |
| `Cmd + Shift + F` | Open global search |
| `Cmd + Shift + N` | Capture clipboard to notebook (global) |
| `Arrow Right` / `Space` | Next slide (fullscreen) |
| `Arrow Left` | Previous slide (fullscreen) |
| `Escape` | Close fullscreen / close modals / close voice overlay |
| `Enter` | Submit in dialogs |

---

## Project Structure

```
src/
  shared/
    types/              # Shared TypeScript interfaces & IPC channel definitions
      index.ts          # Core types (Notebook, Source, Note, ChatMessage, UserMemory, etc.)
      ipc.ts            # IPC channel names & handler type map
  main/                 # Electron main process
    index.ts            # App entry, window creation, protocol registration, tray init
    db/
      index.ts          # SQLite database initialization (auto-create tables)
      schema.ts         # Drizzle ORM schema definitions (including user_memory)
    ipc/
      chat.ts           # Chat message handlers (streaming, agentic RAG, DeepBrain context)
      deepbrain.ts      # DeepBrain bridge handlers (status, recall, file/email search, activity)
      clipboard.ts      # Clipboard history & add-to-notebook handlers
      config.ts         # API key management
      memory.ts         # Cross-session memory CRUD handlers
      notebooks.ts      # CRUD for notebooks
      notes.ts          # CRUD for notes
      research.ts       # Deep research pipeline
      sources.ts        # Source ingestion, parsing, embedding, recommendations
      studio.ts         # Content generation & image slides (with pipeline progress)
      voice.ts          # Voice Q&A session handlers
      workspace.ts      # File tree, editing, syncing
    services/
      ai.ts             # Gemini AI (chat, generation, planning, memory-aware prompts)
      agenticRag.ts     # Multi-query agentic RAG system
      aiMiddleware.ts   # AI output validation & retry middleware pipeline
      chunker.ts        # Document chunking with token counts
      config.ts         # Persistent config store (API key, embeddings model)
      documentParser.ts # PDF, DOCX, TXT/MD parsing
      embeddings.ts     # Gemini embedding generation
      generationPipeline.ts  # Multi-agent Research → Write → Review pipeline
      imagen.ts         # AI image generation for slides
      localEmbeddings.ts     # ONNX local embedding inference
      memory.ts         # Cross-session memory service
      rag.ts            # Retrieval-Augmented Generation (with agentic option)
      recommendations.ts     # Cross-notebook source recommendations
      sourceIngestion.ts     # Shared source processing pipeline
      tieredEmbeddings.ts    # Tiered ONNX → Gemini → hash embedding system
      tray.ts           # System tray icon & clipboard quick-capture
      tts.ts            # Multi-speaker text-to-speech
      vectorStore.ts    # In-memory vector similarity search
      voiceSession.ts   # Voice Q&A session management
      webScraper.ts     # URL content extraction
      workspace.ts      # Filesystem scanning & .gitignore
  preload/
    index.ts            # Context bridge API (typed IPC methods)
  renderer/
    src/
      App.tsx           # Router & top-level routes
      main.tsx          # React entry point
      styles/
        globals.css     # Tailwind v4 config, theme tokens, Tiptap styles
      stores/
        appStore.ts     # Global app state (theme, settings modal)
        notebookStore.ts# Active notebook state
        workspaceStore.ts# Workspace file tree & editor state
      hooks/
        useNotebooks.ts # Notebook listing hook
      components/
        chat/           # ChatPanel, ChatInput, ChatMessage, ChatDeepBrainResults, VoiceOverlay
        common/         # Button, Modal, Spinner, Toast, SettingsModal
        dashboard/      # Dashboard, NotebookCard
        layout/         # AppLayout, Header, ResizablePanel
        notes/          # NotesPanel, NoteEditor
        sources/        # SourcesPanel, SourceList, AddSourceModal
        studio/         # StudioPanel, ToolGrid, GeneratedContentView,
                        # ImageSlidesView, ImageSlidesWizard,
                        # DraggableTextElement, SlideEditorToolbar,
                        # StudioCustomizeDialog
        workspace/      # WorkspaceLayout, FileTreeView, FileTreeNode,
                        # FileEditor, WorkspaceSyncBanner
```

---

## Database Schema

DeepNote AI uses SQLite with 8 tables:

| Table | Description |
|-------|-------------|
| `notebooks` | Notebook metadata (title, emoji, workspace path) |
| `sources` | Ingested documents (content, type, selection state, source guide) |
| `chunks` | Chunked text with token counts for RAG retrieval |
| `notes` | User-created notes (title, content, converted-to-source flag) |
| `chat_messages` | Chat history with citations and DeepBrain metadata (role, content, citations JSON, metadata JSON) |
| `generated_content` | Studio outputs (type, data JSON, status, source IDs) |
| `workspace_files` | Workspace file manifest (path, hash, status, linked source ID) |
| `user_memory` | Cross-session AI memory (type, key, value, confidence score, timestamps) |

All data is stored locally in `~/.config/deepnote-ai/` (or platform equivalent). No data is sent to external servers except Gemini API calls for AI features.

---

## Known Issues (Beta)

This is a beta release. The following issues are known and tracked for future releases:

| Category | Issue | Severity |
|----------|-------|----------|
| **Performance** | Chat message list not virtualized — may slow with very long histories | Medium |
| **Performance** | Vector search uses linear scan (no indexing) — scales poorly with many sources | Medium |
| **Caching** | Audio cache and slide image cache grow unbounded — no automatic cleanup | Low |
| **Caching** | Config file re-read from disk on every access — no in-memory cache | Low |
| **Error Handling** | Some API errors silently swallowed via `.catch(() => {})` — user sees no feedback | Medium |
| **Error Handling** | ~~No error boundaries around chat artifact rendering~~ — **Fixed** in latest build | ~~Medium~~ |
| **Security** | API keys stored as plaintext JSON in config file — should use OS keychain | Medium |
| **UX** | Modal dialogs lack focus trapping and ARIA labels | Low |
| **UX** | Toast notifications can stack/overlap | Low |
| **Accessibility** | Icon-only buttons missing `aria-label` in several components | Low |

We welcome bug reports at [GitHub Issues](https://github.com/Clemens865/DeepNote-AI/issues).

---

## License

This project is provided as-is for educational and personal use.
