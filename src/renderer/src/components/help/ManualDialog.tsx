import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X, Search, BookOpen, MessageSquare, FolderOpen,
  Upload, FileText, Pencil, Sparkles, ChevronRight,
  Globe, BarChart3, BookOpenCheck,
} from 'lucide-react'

interface Section {
  id: string
  title: string
  Icon: React.ComponentType<{ className?: string; size?: number }>
  content: SubSection[]
}

interface SubSection {
  heading: string
  body: string
}

const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    Icon: BookOpen,
    content: [
      {
        heading: 'Creating a Notebook',
        body: 'Click the "+ New Notebook" button on the home screen. Each notebook is an isolated workspace where you can add sources, chat with AI, take notes, and generate studio content. Give it a title and optional emoji to keep things organized.',
      },
      {
        heading: 'API Key Setup',
        body: 'Open Settings (gear icon in the header) and enter your Google Gemini API key. This key is stored locally on your machine and is required for all AI features including chat, embeddings, source analysis, and studio generation.',
      },
      {
        heading: 'Navigation',
        body: 'The home screen lists all your notebooks. Click one to open it. Inside a notebook you\'ll find the Sources panel (left), Chat or Notes view (center), and Studio panel (right). Use the header buttons for global search, dark mode toggle, export, and settings.',
      },
    ],
  },
  {
    id: 'sources',
    title: 'Sources & Ingestion',
    Icon: Upload,
    content: [
      {
        heading: 'Supported Source Types',
        body: 'PDF, DOCX, TXT, Markdown, Excel (XLSX), CSV, PowerPoint (PPTX), Images (JPG/PNG/WebP — OCR via Gemini Vision), Audio files (transcription via Gemini), YouTube URLs (transcript extraction), and Web URLs (content scraping). You can also paste text directly.',
      },
      {
        heading: 'Adding Sources',
        body: 'In the Sources panel click "+ Add Source" and choose a tab matching your content type. Upload a file, paste a URL, or type/paste text. The source is parsed, chunked, and embedded for AI retrieval automatically.',
      },
      {
        heading: 'Selecting & Deselecting',
        body: 'Each source has a checkbox. Only selected sources are included in the AI\'s context for chat and studio generation. Deselect sources you don\'t need for the current task to keep responses focused.',
      },
      {
        heading: 'Source Guides',
        body: 'Each source gets an auto-generated guide — a concise summary of its key topics. This helps you quickly understand what a source covers without reading the full document.',
      },
    ],
  },
  {
    id: 'chat',
    title: 'Chat & AI Interaction',
    Icon: MessageSquare,
    content: [
      {
        heading: 'How Chat Works',
        body: 'The chat uses Retrieval-Augmented Generation (RAG). When you ask a question, relevant chunks from your selected sources are retrieved and included as context for the AI. This grounds responses in your actual documents.',
      },
      {
        heading: 'Chat Modes',
        body: 'Auto mode lets the AI decide how to best answer. Custom mode (accessible from notebook settings) lets you adjust response length (short/medium/long) and provide custom system instructions to tailor the AI\'s behavior.',
      },
      {
        heading: 'Streaming Responses',
        body: 'Responses stream in real-time, token by token. You can see the AI\'s answer forming as it generates.',
      },
      {
        heading: 'Chat Artifacts',
        body: 'The AI can generate rich inline artifacts in chat responses: data tables, charts (bar/line/pie), Mermaid diagrams (flowcharts, sequence diagrams), Kanban boards, KPI gauges, and timelines. These render interactively right in the conversation.',
      },
    ],
  },
  {
    id: 'artifacts',
    title: 'Chat Artifact Types',
    Icon: BarChart3,
    content: [
      {
        heading: 'Data Tables',
        body: 'Structured tables with sortable columns. The AI extracts and organizes data from your sources into clean tabular format.',
      },
      {
        heading: 'Charts (Bar, Line, Pie)',
        body: 'Interactive charts rendered with Recharts. The AI picks the best chart type for the data and generates labeled axes, legends, and tooltips.',
      },
      {
        heading: 'Mermaid Diagrams',
        body: 'Flowcharts, sequence diagrams, entity-relationship diagrams, and more. Rendered from Mermaid syntax — great for visualizing processes, architectures, and relationships.',
      },
      {
        heading: 'Kanban Boards',
        body: 'Task/action-item cards grouped by status (To Do, In Progress, Done) with assignee and priority labels. Useful for extracting action items from meeting notes.',
      },
      {
        heading: 'KPI Gauges',
        body: 'Color-coded metric cards with progress gauges. Sentiment indicators (positive/warning/negative) auto-color based on thresholds. Great for dashboards and survey analysis.',
      },
      {
        heading: 'Timelines',
        body: 'Horizontal scrollable timeline with date markers and event descriptions. Ideal for project milestones, historical events, or deadline tracking.',
      },
    ],
  },
  {
    id: 'notes',
    title: 'Notes',
    Icon: Pencil,
    content: [
      {
        heading: 'Creating Notes',
        body: 'The Notes panel lets you create and edit free-form notes within a notebook. Each note has a title and rich text content.',
      },
      {
        heading: 'Note to Source',
        body: 'You can convert any note into a source, making its content available to the AI for chat and studio generation. This is powerful for adding your own analysis or annotations to the knowledge base.',
      },
    ],
  },
  {
    id: 'studio',
    title: 'Studio Tools',
    Icon: Sparkles,
    content: [
      {
        heading: 'Overview',
        body: 'The Studio panel offers one-click AI generation tools that produce structured content from your selected sources. Click any tool to generate, or click the pencil icon to customize generation options first.',
      },
      {
        heading: 'Audio Overview',
        body: 'Generates a podcast-style multi-speaker discussion about your sources using Gemini TTS. Two AI voices discuss key findings, debates, and insights. Playable directly in the app.',
      },
      {
        heading: 'Slide Deck',
        body: 'Creates a presentation with AI-generated image slides. You can customize the number of slides, visual style, and focus topics before generation.',
      },
      {
        heading: 'Study Flashcards',
        body: 'Transforms your sources into Q&A study cards. Each card has a question on the front and answer on the back, drawn from the source material.',
      },
      {
        heading: 'Report',
        body: 'Generates a detailed analytical report with executive summary, key findings, analysis sections, and recommendations. Customizable format and focus.',
      },
      {
        heading: 'Mind Map',
        body: 'Visualizes the key concepts, themes, and connections across your sources as an interactive mind map.',
      },
      {
        heading: 'Quiz',
        body: 'Auto-generates multiple-choice and short-answer questions to test your understanding of the source material.',
      },
      {
        heading: 'Data Table',
        body: 'Extracts and organizes structured data from your sources into sortable, filterable tables.',
      },
      {
        heading: 'Infographic',
        body: 'Generates a visual infographic summarizing your sources with key stats, quotes, and visual hierarchy.',
      },
      {
        heading: 'Dashboard',
        body: 'Creates a KPI dashboard with metric cards, trend charts (line/bar/pie via Recharts), and summary tables. Great for financial or operational data.',
      },
      {
        heading: 'Literature Review',
        body: 'Structured academic review with thematic analysis, methodology comparison tables, identified research gaps, and actionable recommendations.',
      },
      {
        heading: 'Competitive Analysis',
        body: 'Feature comparison matrix with 1-10 scoring, strengths/weaknesses breakdown, and strategic recommendations across competitors.',
      },
      {
        heading: 'Document Diff',
        body: 'Clause-by-clause comparison of two sources with status labels (added/removed/changed/unchanged) and AI commentary on each difference.',
      },
      {
        heading: 'Citation Graph',
        body: 'Interactive node graph (powered by React Flow) showing relationships between your sources — shared topics, entity overlap, and thematic connections.',
      },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace Notebooks',
    Icon: FolderOpen,
    content: [
      {
        heading: 'What Are Workspace Notebooks?',
        body: 'A workspace notebook is linked to a folder on your filesystem. It scans the directory, shows a file tree, and lets you select which files to index as sources. Great for code repositories, research folders, or document collections.',
      },
      {
        heading: 'Linking a Workspace',
        body: 'When creating a new notebook, choose "Link Workspace Folder" and select a directory. The app scans for supported files, respecting .gitignore patterns.',
      },
      {
        heading: 'File Selection & Indexing',
        body: 'The file tree shows all discovered files. Check files you want indexed — they become regular sources with full RAG, chat, and studio support. Uncheck to remove from the index.',
      },
      {
        heading: 'Auto Re-Index (File Watching)',
        body: 'Workspace notebooks use chokidar to watch for file changes. When files are modified, added, or removed, the index auto-updates. A brief debounce (2 seconds) prevents partial-file reads.',
      },
      {
        heading: 'Sync',
        body: 'You can also manually trigger a sync to re-scan the filesystem and detect new, changed, or deleted files.',
      },
    ],
  },
  {
    id: 'search',
    title: 'Global Search',
    Icon: Globe,
    content: [
      {
        heading: 'Cross-Notebook Search',
        body: 'Click the search icon in the header (or press Cmd+K) to open the global search dialog. Searches across ALL notebooks using semantic vector similarity — not just keyword matching.',
      },
      {
        heading: 'Results',
        body: 'Results are grouped by notebook, showing the source title, text snippet, page number, and relevance score. Click a result to navigate directly to that notebook.',
      },
    ],
  },
  {
    id: 'export',
    title: 'Export & Sharing',
    Icon: FileText,
    content: [
      {
        heading: 'Export Formats',
        body: 'Inside a notebook, click the download icon in the header. Choose JSON (full structured data) or HTML (readable document). The export includes sources, chat history, notes, and generated content.',
      },
    ],
  },
  {
    id: 'tips',
    title: 'Tips & Best Practices',
    Icon: BookOpenCheck,
    content: [
      {
        heading: 'Quality Sources = Better AI',
        body: 'The AI is only as good as the sources you provide. Well-structured documents with clear headings, clean text, and relevant content produce the best results.',
      },
      {
        heading: 'Use Source Selection Strategically',
        body: 'If you have many sources, select only the ones relevant to your current question. This reduces noise and improves answer quality.',
      },
      {
        heading: 'Leverage Studio Customization',
        body: 'Click the pencil icon on any Studio tool to customize before generating. You can focus on specific topics, adjust depth, or change formatting.',
      },
      {
        heading: 'Combine Chat + Studio',
        body: 'Use chat to explore and ask questions, then use Studio tools to generate polished output. Chat artifacts give quick inline visuals; Studio gives full standalone documents.',
      },
      {
        heading: 'Notes as Sources',
        body: 'Write notes with your own analysis or key takeaways, then convert them to sources. The AI will incorporate your insights alongside the original documents.',
      },
    ],
  },
]

interface ManualDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ManualDialog({ isOpen, onClose }: ManualDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started')
  const inputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setSearchQuery('')
      setExpandedSection('getting-started')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return SECTIONS
    const q = searchQuery.toLowerCase()
    return SECTIONS.map((section) => {
      const matchingContent = section.content.filter(
        (sub) =>
          sub.heading.toLowerCase().includes(q) ||
          sub.body.toLowerCase().includes(q)
      )
      const titleMatch = section.title.toLowerCase().includes(q)
      if (titleMatch || matchingContent.length > 0) {
        return { ...section, content: titleMatch ? section.content : matchingContent }
      }
      return null
    }).filter(Boolean) as Section[]
  }, [searchQuery])

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 shrink-0">
          <BookOpen size={18} className="text-indigo-500 flex-shrink-0" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">User Manual</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <Search size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value.trim()) setExpandedSection(null)
              }}
              placeholder="Search the manual..."
              className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No results for "{searchQuery}"
            </div>
          )}

          {filtered.map((section) => {
            const isExpanded = searchQuery.trim() ? true : expandedSection === section.id
            return (
              <div key={section.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    <section.Icon size={14} />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">
                    {section.title}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-1">
                    {section.content.length} {section.content.length === 1 ? 'topic' : 'topics'}
                  </span>
                  <ChevronRight
                    size={14}
                    className={`text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4">
                    {section.content.map((sub, i) => (
                      <div key={i} className="ml-10 mb-3 last:mb-0">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {sub.heading}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {sub.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 shrink-0">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
            DeepNote AI — Press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  )
}
