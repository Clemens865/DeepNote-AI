# DeepNote AI — Intelligent Notebook Platform

## What is DeepNote AI?

DeepNote AI is a desktop application that transforms how people interact with documents, research, and knowledge. Built as an Electron app with a modern React interface, it combines document ingestion, AI-powered analysis, and creative content generation into a single cohesive workspace.

Think of it as a personal research assistant that can read your documents, answer questions about them, and generate entirely new formats — from podcast-style audio discussions to AI-generated slide decks with custom visual styles.

## Core Capabilities

### 1. Multi-Format Document Ingestion

DeepNote AI accepts a wide range of input formats:

- **PDF documents** — academic papers, reports, manuals
- **Word documents (DOCX)** — business documents, proposals
- **Plain text and Markdown** — notes, articles, code documentation
- **Web URLs** — any publicly accessible webpage
- **YouTube videos** — automatic transcript extraction via Gemini
- **Audio files** — speech-to-text transcription for podcasts, lectures, meetings
- **Pasted text** — quick clipboard content for ad-hoc analysis

Each ingested source is automatically chunked, embedded using Gemini's text-embedding model, and stored in a local SQLite database for fast retrieval.

### 2. RAG-Powered Chat

The chat system uses Retrieval-Augmented Generation (RAG) to provide accurate, source-grounded answers:

- Questions are embedded and matched against document chunks using cosine similarity
- Relevant context is injected into the Gemini prompt alongside the user's question
- Every response includes citations pointing back to specific source passages
- Streaming responses appear token-by-token for a responsive experience
- Users can select which sources are active for each conversation

#### Interactive Chat Artifacts

The AI can embed rich, interactive visualizations directly in chat responses. Six artifact types are supported:

| Artifact | Description |
|----------|-------------|
| **Table** | Sortable, scrollable data tables with columns and rows |
| **Chart** | Interactive bar, line, or pie charts with tooltips and legends |
| **Mermaid Diagram** | Flowcharts, sequence diagrams, ER diagrams, and more |
| **Kanban Board** | Task cards with assignee, priority, and status columns |
| **KPI Cards** | Color-coded metric cards with progress bars and sentiment indicators |
| **Timeline** | Horizontal scrollable timeline with dated events and descriptions |

#### Artifact Shortcut Chips

Six quick-action buttons appear above the chat input when sources are selected. Each sends a pre-built prompt to instantly generate a specific artifact type:

- **Table** — Summarize key data as a table
- **Chart** — Visualize important data as a chart
- **Diagram** — Map concepts and relationships as a Mermaid diagram
- **Kanban** — Extract action items as a Kanban board
- **KPIs** — Surface key metrics as KPI cards
- **Timeline** — Plot events and milestones on a timeline

### 3. Studio — Creative Content Generation

The Studio is where DeepNote AI truly differentiates itself. It can transform your source material into seven distinct output formats.

#### Generated Content Management

The generated content list includes built-in search, filter, and sort controls:

- **Search** — Filter items by title with a real-time text search
- **Type filter chips** — Click a type chip (e.g., "Slides", "Report", "Quiz") to show only that content type. An "All" chip resets the filter.
- **Sort dropdown** — Reorder items by Newest, Oldest, Title A-Z, or grouped by Type
- **Item count** — The heading shows the number of matching items

#### Audio Overview
Generates a multi-speaker podcast-style discussion using Gemini's TTS capabilities. Two AI voices (one male, one female) have a natural conversation about your content — covering key points, debating implications, and explaining complex topics. Supports four formats: deep-dive, brief overview, critical analysis, and debate.

#### AI-Generated Image Slide Decks
Creates presentation slide decks with AI-generated visuals. Two rendering modes:

- **Full Image Mode** — text is baked directly into each AI-generated slide image
- **Hybrid/Editable Mode** — AI generates background visuals while text is rendered as editable HTML overlays with a rich text editor

Six modern tech-inspired visual styles are available:
- Neon Circuit (cyberpunk, purple & cyan neon glow)
- Glass Morphism (frosted glass panels, dark gradient)
- Gradient Mesh (pink-to-blue gradient blobs, startup aesthetic)
- Terminal (phosphor green, matrix data streams)
- Cosmic Dark (violet & rose nebula, deep space)
- Arctic Frost (ice blue, crystalline geometric shapes)

Users can also create fully custom styles by picking their own color palette and describing the visual aesthetic they want.

#### Rich Slide Editor
The hybrid slide mode includes a full rich text editor powered by Tiptap (ProseMirror-based):
- Bold, italic, underline, strikethrough formatting
- Text alignment (left, center, right)
- Font size control (12px to 48px)
- Color picker with preset palette
- Hyperlink insertion
- Bullet lists
- Individual text elements are freely draggable and resizable
- New text boxes can be added anywhere on the slide
- AI-driven layout: the LLM designs optimal element placement based on content

#### Quiz Generator
Creates multiple-choice quizzes from your source material with configurable difficulty (easy, medium, hard) and question count.

#### Flashcard Generator
Produces study flashcards with question-answer pairs, adjustable difficulty and card count.

#### Mind Map
Generates hierarchical mind maps visualizing the key concepts and relationships within your sources.

#### Data Table
Extracts and structures data from your sources into organized tables.

#### Report
Produces comprehensive written reports summarizing and analyzing your source material.

### 4. Source Guides

For each ingested source, DeepNote AI can generate a detailed source guide — an AI-written summary that covers key themes, main arguments, important data points, and suggested questions. This helps users quickly understand what each document contains without reading it in full.

### 5. Notes System

An integrated notes panel allows users to:
- Create free-form notes within any notebook
- Auto-generate notes from specific sources
- Convert notes back into sources (making them searchable via RAG)
- Edit notes with full text formatting

### 6. Deep Research

A multi-step research pipeline that goes beyond simple Q&A:
- Breaks complex research questions into sub-queries
- Executes multiple parallel searches across your sources
- Synthesizes findings into a comprehensive research report
- Broadcasts real-time progress updates during the research process

### 7. Workspace-Backed Notebooks

Notebooks can be linked to a local folder on your filesystem:
- File tree browser shows all files in the workspace
- Select individual files for indexing (they become sources)
- Automatic change detection — modified files are flagged as stale
- .gitignore pattern support for filtering irrelevant files
- Full integration with all existing features (chat, studio, notes)

## Technical Architecture

### Stack
- **Desktop Runtime**: Electron 39 with electron-vite build system
- **Frontend**: React 19, TypeScript 5, Tailwind CSS v4
- **State Management**: Zustand stores
- **Routing**: react-router-dom v7
- **Database**: SQLite via better-sqlite3 v12.6 with Drizzle ORM
- **AI Provider**: Google Gemini (chat, embeddings, TTS, image generation)
- **Rich Text**: Tiptap (ProseMirror) with custom extensions
- **Drag & Drop**: react-draggable for slide element positioning

### Database Schema
Seven SQLite tables form the data model:
- `notebooks` — top-level containers with optional workspace path
- `sources` — ingested documents with full text content
- `chunks` — text fragments with vector embeddings for RAG
- `notes` — user-created and AI-generated notes
- `chat_messages` — conversation history with citations
- `generated_content` — studio outputs (audio, slides, quizzes, etc.)
- `workspace_files` — filesystem manifest for workspace notebooks

### Process Architecture
- **Main Process**: Database access, AI service calls, file I/O, IPC handlers
- **Preload**: Typed context bridge exposing safe API to renderer
- **Renderer**: React UI with no direct access to Node.js APIs

All AI operations run in the main process. Long-running tasks (audio generation, slide image generation, deep research) use a fire-and-forget pattern — the IPC handler returns immediately while the work continues asynchronously, broadcasting progress events to the renderer via `BrowserWindow.webContents.send()`.

## What Makes DeepNote AI Unique

1. **Everything is local** — your documents never leave your machine. The only external calls are to the Gemini API for AI inference.
2. **Multi-modal output** — the same source material can become a podcast, a slide deck, a quiz, a mind map, or a research report.
3. **Editable AI output** — hybrid slides aren't static images. Every text element can be repositioned, restyled, and rewritten after generation.
4. **AI-designed layouts** — the LLM doesn't just generate content, it designs the visual layout of each slide based on the amount and type of content.
5. **Custom visual identity** — users can define their own color palettes and style descriptions for slide generation, going beyond fixed presets.
6. **Workspace integration** — link a notebook to a code repository or document folder and selectively index files without manually uploading each one.
