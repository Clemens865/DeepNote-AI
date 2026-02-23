import { useState, useEffect } from 'react'
import { Spinner } from '../common/Spinner'
import { useNotebookStore } from '../../stores/notebookStore'
import type { GeneratedContent, StudioToolOptions } from '@shared/types'
import {
  Headphones, BrainCircuit, FileBarChart, Layers,
  HelpCircle, Presentation, Table2, ArrowRight,
  CheckCircle2, Pencil, ImageIcon, LayoutDashboard,
  BookOpen, Trophy, GitCompare, Network, FileText,
} from 'lucide-react'

interface Tool {
  id: string
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string; size?: number }>
  enabled?: boolean
}

const TOOLS: Tool[] = [
  { id: 'audio', label: 'Audio Overview', description: 'Generate a podcast-style discussion.', Icon: Headphones, enabled: true },
  { id: 'slides', label: 'Slide Deck', description: 'Generate AI image-based presentation slides.', Icon: Presentation, enabled: true },
  { id: 'flashcard', label: 'Study Flashcards', description: 'Transform sources into Q&A study cards.', Icon: Layers, enabled: true },
  { id: 'report', label: 'Report', description: 'Create a detailed analytical report.', Icon: FileBarChart, enabled: true },
  { id: 'mindmap', label: 'Mind Map', description: 'Visualize the key concepts and connections.', Icon: BrainCircuit, enabled: true },
  { id: 'quiz', label: 'Quiz', description: 'Test your knowledge with auto-generated questions.', Icon: HelpCircle, enabled: true },
  { id: 'datatable', label: 'Data Table', description: 'Extract and organize data into tables.', Icon: Table2, enabled: true },
  { id: 'infographic', label: 'Infographic', description: 'Generate a visual infographic from your sources.', Icon: ImageIcon, enabled: true },
  { id: 'dashboard', label: 'Dashboard', description: 'Generate a KPI dashboard with charts and tables.', Icon: LayoutDashboard, enabled: true },
  { id: 'literature-review', label: 'Literature Review', description: 'Structured review with themes, gaps, and recommendations.', Icon: BookOpen, enabled: true },
  { id: 'competitive-analysis', label: 'Competitive Analysis', description: 'Feature comparison matrix with scoring.', Icon: Trophy, enabled: true },
  { id: 'diff', label: 'Document Diff', description: 'Compare two sources clause-by-clause.', Icon: GitCompare, enabled: true },
  { id: 'citation-graph', label: 'Citation Graph', description: 'Visualize relationships between your sources.', Icon: Network, enabled: true },
  { id: 'whitepaper', label: 'White Paper', description: 'Generate a professional white paper with images, citations, and references.', Icon: FileText, enabled: true },
]

interface ToolGridProps {
  onGenerated?: (content: GeneratedContent) => void
  onOpenImageSlidesWizard?: () => void
  onOpenCustomize?: (toolId: string, toolLabel: string) => void
  onGenerateWithOptions?: (toolId: string, options: StudioToolOptions) => void
  onOpenReportFormat?: () => void
  onStartInfographic?: () => void
  onStartWhitePaper?: () => void
}

export function ToolGrid({ onGenerated, onOpenImageSlidesWizard, onOpenCustomize, onOpenReportFormat, onStartInfographic, onStartWhitePaper }: ToolGridProps) {
  const [toast, setToast] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)
  const [hasGeminiKey, setHasGeminiKey] = useState(true) // optimistic default
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const sources = useNotebookStore((s) => s.sources)

  useEffect(() => {
    window.api.getApiKey().then((key: string) => setHasGeminiKey(!!key))
  }, [])

  const selectedCount = sources.filter((s) => s.isSelected).length
  const totalCount = sources.length

  const handleClick = async (tool: Tool) => {
    if (generating) return // guard against double-clicks
    if (!tool.enabled) {
      setToast(`${tool.label} coming soon!`)
      setTimeout(() => setToast(null), 2000)
      return
    }

    // Intercept slides to open image slides wizard
    if (tool.id === 'slides' && onOpenImageSlidesWizard) {
      setGenerating(tool.id)
      onOpenImageSlidesWizard()
      setTimeout(() => setGenerating(null), 500)
      return
    }

    // Intercept infographic for fire-and-forget generation
    if (tool.id === 'infographic' && onStartInfographic) {
      setGenerating(tool.id)
      onStartInfographic()
      setTimeout(() => setGenerating(null), 500)
      return
    }

    // Intercept whitepaper for fire-and-forget generation
    if (tool.id === 'whitepaper' && onStartWhitePaper) {
      setGenerating(tool.id)
      onStartWhitePaper()
      setTimeout(() => setGenerating(null), 500)
      return
    }

    if (!currentNotebook) return
    if (selectedCount === 0) {
      setToast('Please add and select at least one source first.')
      setTimeout(() => setToast(null), 3000)
      return
    }

    setGenerating(tool.id)
    try {
      const result = await window.api.studioGenerate({
        notebookId: currentNotebook.id,
        type: tool.id,
      }) as GeneratedContent
      if (result && onGenerated) {
        onGenerated(result)
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Generation failed')
      setTimeout(() => setToast(null), 4000)
    } finally {
      setGenerating(null)
    }
  }

  const handleEditClick = (e: React.MouseEvent, tool: Tool) => {
    e.stopPropagation()
    if (tool.id === 'slides' && onOpenImageSlidesWizard) {
      onOpenImageSlidesWizard()
      return
    }
    if (tool.id === 'report' && onOpenReportFormat) {
      onOpenReportFormat()
      return
    }
    if (tool.id === 'infographic' && onStartInfographic) {
      onStartInfographic()
      return
    }
    if (tool.id === 'whitepaper' && onStartWhitePaper) {
      onStartWhitePaper()
      return
    }
    onOpenCustomize?.(tool.id, tool.label)
  }

  return (
    <div className="space-y-3">
      {!hasGeminiKey && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          Set your Gemini API key in Settings to unlock Studio generation.
        </div>
      )}
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => handleClick(tool)}
          disabled={generating !== null || !hasGeminiKey}
          className={`w-full text-left p-4 rounded-2xl glass-panel glass-panel-hover group relative overflow-hidden disabled:opacity-60 ${!hasGeminiKey ? 'opacity-40 pointer-events-none' : ''}`}
        >
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-10 h-10 bg-indigo-50/80 dark:bg-indigo-500/[0.08] rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 group-hover:text-white transition-colors flex-shrink-0 shadow-inner">
              {generating === tool.id ? (
                <Spinner size="sm" />
              ) : (
                <tool.Icon size={20} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-200 mb-0.5">
                {generating === tool.id ? 'Generating...' : tool.label}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{tool.description}</p>
            </div>
            {/* Edit button */}
            <div
              onClick={(e) => handleEditClick(e, tool)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer z-20"
              title={`Customize ${tool.label}`}
            >
              <Pencil size={14} />
            </div>
          </div>
          <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight size={14} className="text-indigo-400 dark:text-indigo-500" />
          </div>
        </button>
      ))}

      {/* Notebook Health */}
      <div className="mt-6 bg-black/[0.02] dark:bg-white/[0.01] rounded-2xl p-5 border border-black/[0.05] dark:border-white/[0.05]">
        <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-green-500" />
          Notebook Health
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Sources Selected</span>
            <span className="font-bold text-zinc-700 dark:text-zinc-300">{selectedCount}/{totalCount}</span>
          </div>
          <div className="w-full bg-black/[0.05] dark:bg-white/[0.05] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-500 relative"
              style={{ width: `${totalCount ? (selectedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 italic">
            {totalCount > 0
              ? 'AI has indexed your context for grounded responses.'
              : 'Add sources to begin.'}
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] px-6 py-3 rounded-xl shadow-xl text-sm text-zinc-800 dark:text-zinc-200 z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
