# DeepNote AI

A feature-rich, open-source desktop application inspired by Google's NotebookLM. Built with Electron, React, and powered by Google Gemini AI. Upload documents, chat with your sources, and generate studio-quality content including AI podcasts, image slide decks with a drag-and-drop editor, flashcards, quizzes, mind maps, reports, and more.

![DeepNote AI](Screenshots/Bildschirmfoto%202026-02-09%20um%2022.37.37.png)

---

## Table of Contents

- [Features Overview](#features-overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running](#running)
  - [Building](#building)
- [Application Guide](#application-guide)
  - [Notebooks](#notebooks)
  - [Sources](#sources)
  - [Chat](#chat)
    - [Interactive Artifacts](#interactive-artifacts)
    - [Artifact Shortcut Chips](#artifact-shortcut-chips)
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
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [License](#license)

---

## Features Overview

| Category | Features |
|----------|----------|
| **Source Ingestion** | PDF, DOCX, TXT, Markdown, Website URLs, YouTube transcripts, Audio files (MP3/WAV/M4A/OGG/FLAC), Paste text |
| **AI Chat** | Streaming responses, source-grounded citations, conversation history, suggested prompts, 6 interactive artifact types (Table, Chart, Mermaid, Kanban, KPI, Timeline), one-click artifact shortcut chips |
| **Deep Research** | Multi-step AI analysis with real-time progress updates |
| **Audio Overview** | Multi-speaker AI podcast with 4 format styles (Deep Dive, Brief, Critical Analysis, Debate) |
| **Image Slides** | AI-generated slide decks with 6 visual styles, 2 render modes, fullscreen presenter, rich text drag-and-drop editor |
| **Study Tools** | Flashcards, Quizzes (multiple choice), Reports, Mind Maps, Data Tables, search/filter/sort for generated content |
| **Notes** | Create, edit, auto-save notes; convert notes to sources for AI context |
| **Workspace** | Link local folders, file tree browser, text editor with AI rewrite, .gitignore support |
| **Export** | Download audio as WAV, slides as PNG, copy reports to clipboard |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Electron 39 via electron-vite |
| **Frontend** | React 19, TypeScript 5, Tailwind CSS v4 |
| **State** | Zustand |
| **Routing** | react-router-dom v7 |
| **Database** | SQLite (better-sqlite3 v12.6) + Drizzle ORM |
| **AI** | Google Gemini (`@google/genai`) |
| **Rich Text** | Tiptap (ProseMirror-based) |
| **Drag & Drop** | react-draggable |
| **Document Parsing** | pdf-parse, mammoth (DOCX) |
| **Icons** | lucide-react |
| **Font** | Inter (bundled via @fontsource-variable) |

**AI Models Used:**
- `gemini-2.0-flash` - Chat, content generation, document analysis
- `gemini-2.5-flash-preview-tts` - Multi-speaker text-to-speech
- `gemini-embedding-exp-03-07` - Text embeddings for RAG
- Image generation model - AI slide backgrounds

---

## Getting Started

### Prerequisites

- **Node.js** 20+ and npm
- **Google Gemini API Key** (free at [aistudio.google.com](https://aistudio.google.com/apikey))

### Installation

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

---

### Chat

The **Chat Panel** is the main interaction mode. Ask questions and get AI-generated answers grounded in your selected sources.

- **Streaming responses** - Answers appear token-by-token in real time
- **Source citations** - Responses include `[Source N]` references linking to specific source chunks
- **Suggested prompts** - Quick-start buttons: "Summarize my sources", "Key takeaways", "Create a study guide"
- **Upload from chat** - Add new documents or audio files directly from the chat input
- **Save to Note** - Save any AI response as a note for later reference
- **Clear history** - Reset the conversation

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

The **Studio Panel** contains 7 AI-powered content generation tools. Each tool transforms your selected sources into a different output format.

All studio tools support:
- **Custom instructions** - Guide the AI's focus and audience
- **Length options** - Short, Default, or Long output
- **Rename** generated content
- **Delete** generated content
- **Generation history** - All past outputs are accessible
- **Search & filter** - Find generated items by title, filter by type, sort by newest/oldest/title/type

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
- **Click outside** to deselect elements

**Presentation Features:**
- **Fullscreen Mode** - Press the expand button for a full-screen presentation
- **Keyboard Navigation** - Arrow keys and Space to advance slides
- **Thumbnail Strip** - Visual slide navigator
- **Speaker Notes** - Show/hide AI-generated speaker notes per slide
- **Download** - Save individual slides as PNG files

![Slide Deck](Screenshots_Notebook_Presentations/Bildschirmfoto%202026-02-10%20um%2014.15.58.png)

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

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save file in workspace editor |
| `Cmd/Ctrl + K` | Open AI rewrite popup (with text selected) |
| `Arrow Right` / `Space` | Next slide (fullscreen) |
| `Arrow Left` | Previous slide (fullscreen) |
| `Escape` | Close fullscreen / close modals |
| `Enter` | Submit in dialogs |

---

## Project Structure

```
src/
  shared/
    types/              # Shared TypeScript interfaces & IPC channel definitions
      index.ts          # Core types (Notebook, Source, Note, ChatMessage, etc.)
      ipc.ts            # IPC channel names & handler type map
  main/                 # Electron main process
    index.ts            # App entry, window creation, protocol registration
    db/
      index.ts          # SQLite database initialization (auto-create tables)
      schema.ts         # Drizzle ORM schema definitions
    ipc/
      chat.ts           # Chat message handlers (streaming)
      config.ts         # API key management
      notebooks.ts      # CRUD for notebooks
      notes.ts          # CRUD for notes
      research.ts       # Deep research pipeline
      sources.ts        # Source ingestion, parsing, embedding
      studio.ts         # Content generation & image slides
      workspace.ts      # File tree, editing, syncing
    services/
      ai.ts             # Gemini AI (chat, generation, planning)
      chunker.ts        # Document chunking with token counts
      config.ts         # Persistent config store
      documentParser.ts # PDF, DOCX, TXT/MD parsing
      embeddings.ts     # Gemini embedding generation
      imagen.ts         # AI image generation for slides
      rag.ts            # Retrieval-Augmented Generation
      sourceIngestion.ts# Shared source processing pipeline
      tts.ts            # Multi-speaker text-to-speech
      vectorStore.ts    # In-memory vector similarity search
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
        chat/           # ChatPanel, ChatInput, ChatMessage
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

DeepNote AI uses SQLite with 7 tables:

| Table | Description |
|-------|-------------|
| `notebooks` | Notebook metadata (title, emoji, workspace path) |
| `sources` | Ingested documents (content, type, selection state, source guide) |
| `chunks` | Chunked text with token counts for RAG retrieval |
| `notes` | User-created notes (title, content, converted-to-source flag) |
| `chat_messages` | Chat history with citations (role, content, citations JSON) |
| `generated_content` | Studio outputs (type, data JSON, status, source IDs) |
| `workspace_files` | Workspace file manifest (path, hash, status, linked source ID) |

All data is stored locally in `~/.config/deepnote-ai/` (or platform equivalent). No data is sent to external servers except Gemini API calls for AI features.

---

## License

This project is provided as-is for educational and personal use.
