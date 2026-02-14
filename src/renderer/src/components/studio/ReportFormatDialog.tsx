import { useState, useEffect } from 'react'
import { X, Loader2, Sparkles } from 'lucide-react'
import type { StudioToolOptions } from '@shared/types'

interface ReportFormat {
  title: string
  description: string
  prompt: string
}

const PRESET_FORMATS: ReportFormat[] = [
  {
    title: 'Briefing Doc',
    description: 'Concise executive briefing with key findings, analysis, and recommendations.',
    prompt: 'Write a concise executive briefing document. Structure it with an Executive Summary, Key Findings, Analysis, and Recommendations sections. Use bullet points for clarity.',
  },
  {
    title: 'Study Guide',
    description: 'Educational study guide with key concepts, definitions, and review questions.',
    prompt: 'Create a comprehensive study guide. Include Key Concepts with definitions, Important Details organized by topic, Summary Tables where appropriate, and Review Questions at the end.',
  },
  {
    title: 'Blog Post',
    description: 'Engaging narrative article with an introduction, body, and conclusion.',
    prompt: 'Write an engaging blog post. Use a compelling introduction, organize the body with clear headings, include relevant examples and analogies, and end with a strong conclusion.',
  },
]

interface ReportFormatDialogProps {
  onGenerate: (options: StudioToolOptions) => void
  onClose: () => void
  isGenerating: boolean
  notebookId: string
}

export function ReportFormatDialog({ onGenerate, onClose, isGenerating, notebookId }: ReportFormatDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat | null>(null)
  const [customDescription, setCustomDescription] = useState('')
  const [suggestedFormats, setSuggestedFormats] = useState<ReportFormat[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingSuggestions(true)
    window.api.studioSuggestFormats(notebookId)
      .then((formats: ReportFormat[]) => {
        if (!cancelled) setSuggestedFormats(formats)
      })
      .catch(() => {
        // Silently fail — suggestions are optional
      })
      .finally(() => {
        if (!cancelled) setLoadingSuggestions(false)
      })
    return () => { cancelled = true }
  }, [notebookId])

  const handleGenerate = () => {
    const opts: StudioToolOptions = {
      reportFormat: selectedFormat?.prompt || undefined,
      description: customDescription.trim() || undefined,
    }
    onGenerate(opts)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 rounded-t-2xl">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Create Report</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Preset Formats */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              Format
            </label>
            <div className="grid grid-cols-1 gap-2">
              {PRESET_FORMATS.map((fmt) => (
                <button
                  key={fmt.title}
                  onClick={() => setSelectedFormat(selectedFormat?.title === fmt.title ? null : fmt)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    selectedFormat?.title === fmt.title
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{fmt.title}</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{fmt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* AI-Suggested Formats */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              Suggested for Your Sources
            </label>
            {loadingSuggestions ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 size={14} className="text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-400">Analyzing your sources...</span>
              </div>
            ) : suggestedFormats.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {suggestedFormats.map((fmt) => (
                  <button
                    key={fmt.title}
                    onClick={() => setSelectedFormat(selectedFormat?.title === fmt.title ? null : fmt)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      selectedFormat?.title === fmt.title
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={10} className="text-amber-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{fmt.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{fmt.description}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                No suggestions available — select a preset or describe your report below.
              </p>
            )}
          </div>

          {/* Custom description */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              Custom Instructions (optional)
            </label>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="Add any specific focus areas, topics to emphasize, or special instructions..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>

          {/* Generate button */}
          {isGenerating && (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="text-indigo-500 animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Generating report...</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
