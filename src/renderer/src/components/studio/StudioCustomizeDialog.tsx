import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Loader2 } from 'lucide-react'
import type { StudioToolOptions } from '@shared/types'

interface StudioCustomizeDialogProps {
  toolId: string
  toolLabel: string
  onGenerate: (options: StudioToolOptions) => void
  onClose: () => void
  isGenerating: boolean
}

// Toggle button group helper
function ToggleGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
        {label}
      </label>
      <div className="flex rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              value === opt.value
                ? 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-100'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
            }`}
          >
            {value === opt.value && <Check size={12} />}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function StudioCustomizeDialog({
  toolId,
  toolLabel,
  onGenerate,
  onClose,
  isGenerating,
}: StudioCustomizeDialogProps) {
  // Audio options
  const [audioFormat, setAudioFormat] = useState<string>('deep-dive')
  const [audioLength, setAudioLength] = useState<string>('default')

  // Flashcard / Quiz options
  const [cardCount, setCardCount] = useState<string>('standard')
  const [questionCount, setQuestionCount] = useState<string>('standard')
  const [difficulty, setDifficulty] = useState<string>('medium')

  // Mind Map options
  const [mindmapDepth, setMindmapDepth] = useState<string>('standard')
  const [mindmapBranches, setMindmapBranches] = useState<string>('standard')
  const [mindmapStyle, setMindmapStyle] = useState<string>('overview')

  // Dashboard options
  const [dashboardKpiCount, setDashboardKpiCount] = useState<string>('standard')
  const [dashboardChartPreference, setDashboardChartPreference] = useState<string>('mixed')
  const [dashboardDensity, setDashboardDensity] = useState<string>('standard')

  // Citation Graph options
  const [citationDetail, setCitationDetail] = useState<string>('standard')
  const [citationTopicDepth, setCitationTopicDepth] = useState<string>('standard')

  // Shared
  const [description, setDescription] = useState('')

  const handleGenerate = () => {
    const opts: StudioToolOptions = {}

    switch (toolId) {
      case 'audio':
        opts.audioFormat = audioFormat as StudioToolOptions['audioFormat']
        opts.length = audioLength as StudioToolOptions['length']
        break
      case 'flashcard':
        opts.cardCount = cardCount as StudioToolOptions['cardCount']
        opts.difficulty = difficulty as StudioToolOptions['difficulty']
        break
      case 'quiz':
        opts.questionCount = questionCount as StudioToolOptions['questionCount']
        opts.difficulty = difficulty as StudioToolOptions['difficulty']
        break
      case 'mindmap':
        opts.mindmapDepth = mindmapDepth as StudioToolOptions['mindmapDepth']
        opts.mindmapBranches = mindmapBranches as StudioToolOptions['mindmapBranches']
        opts.mindmapStyle = mindmapStyle as StudioToolOptions['mindmapStyle']
        break
      case 'dashboard':
        opts.dashboardKpiCount = dashboardKpiCount as StudioToolOptions['dashboardKpiCount']
        opts.dashboardChartPreference = dashboardChartPreference as StudioToolOptions['dashboardChartPreference']
        opts.dashboardDensity = dashboardDensity as StudioToolOptions['dashboardDensity']
        break
      case 'citation-graph':
        opts.citationDetail = citationDetail as StudioToolOptions['citationDetail']
        opts.citationTopicDepth = citationTopicDepth as StudioToolOptions['citationTopicDepth']
        break
    }

    if (description.trim()) {
      opts.description = description.trim()
    }

    onGenerate(opts)
  }

  const placeholders: Record<string, string> = {
    audio: 'Describe a focus area or special instructions for the audio overview...',
    flashcard: 'Describe specific topics or areas to focus on for the flashcards...',
    quiz: 'Describe specific topics or areas to focus on for the quiz...',
    report: 'Describe the report you want — e.g., focus on specific aspects, comparison style, executive summary...',
    mindmap: 'Describe the mind map you want — e.g., focus on relationships, hierarchy, specific theme...',
    datatable: 'Describe the table you want — e.g., comparison table, timeline, feature matrix...',
    dashboard: 'Describe the dashboard you want — e.g., focus on financials, trends, KPIs...',
    'citation-graph': 'Describe what relationships to focus on — e.g., shared themes, methodology links...',
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/[0.06] w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.04] shrink-0 rounded-t-2xl">
          <h2 className="font-bold text-zinc-800 dark:text-zinc-100">Customize {toolLabel}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Audio-specific options */}
          {toolId === 'audio' && (
            <>
              <div>
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
                  Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'deep-dive', name: 'Deep Dive', desc: 'Thorough, comprehensive discussion exploring every major topic.' },
                    { id: 'brief', name: 'Brief Overview', desc: 'Short, punchy summary focused on the most important points.' },
                    { id: 'critique', name: 'Critical Analysis', desc: 'Balanced analysis of strengths and weaknesses.' },
                    { id: 'debate', name: 'Debate', desc: 'Two hosts take opposing perspectives, intellectual debate.' },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => setAudioFormat(fmt.id)}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        audioFormat === fmt.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                          : 'border-black/[0.06] dark:border-white/[0.06] hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{fmt.name}</span>
                        {audioFormat === fmt.id && <Check size={14} className="text-indigo-500" />}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{fmt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <ToggleGroup
                label="Length"
                options={[
                  { value: 'short', label: 'Short' },
                  { value: 'default', label: 'Default' },
                  { value: 'long', label: 'Long' },
                ]}
                value={audioLength}
                onChange={setAudioLength}
              />
            </>
          )}

          {/* Flashcard-specific options */}
          {toolId === 'flashcard' && (
            <>
              <ToggleGroup
                label="Number of Cards"
                options={[
                  { value: 'fewer', label: 'Fewer' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'more', label: 'More' },
                ]}
                value={cardCount}
                onChange={setCardCount}
              />
              <ToggleGroup
                label="Difficulty"
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
                value={difficulty}
                onChange={setDifficulty}
              />
            </>
          )}

          {/* Quiz-specific options */}
          {toolId === 'quiz' && (
            <>
              <ToggleGroup
                label="Number of Questions"
                options={[
                  { value: 'fewer', label: 'Fewer' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'more', label: 'More' },
                ]}
                value={questionCount}
                onChange={setQuestionCount}
              />
              <ToggleGroup
                label="Difficulty"
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
                value={difficulty}
                onChange={setDifficulty}
              />
            </>
          )}

          {/* Mind Map options */}
          {toolId === 'mindmap' && (
            <>
              <ToggleGroup
                label="Depth"
                options={[
                  { value: 'shallow', label: 'Shallow (2 levels)' },
                  { value: 'standard', label: 'Standard (3 levels)' },
                  { value: 'deep', label: 'Deep (4 levels)' },
                ]}
                value={mindmapDepth}
                onChange={setMindmapDepth}
              />
              <ToggleGroup
                label="Branch Count"
                options={[
                  { value: 'fewer', label: 'Fewer' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'more', label: 'More' },
                ]}
                value={mindmapBranches}
                onChange={setMindmapBranches}
              />
              <ToggleGroup
                label="Focus Style"
                options={[
                  { value: 'overview', label: 'Overview' },
                  { value: 'detailed', label: 'Detailed' },
                  { value: 'relationships', label: 'Relationships' },
                ]}
                value={mindmapStyle}
                onChange={setMindmapStyle}
              />
            </>
          )}

          {/* Dashboard options */}
          {toolId === 'dashboard' && (
            <>
              <ToggleGroup
                label="KPI Cards"
                options={[
                  { value: 'fewer', label: 'Fewer (2-3)' },
                  { value: 'standard', label: 'Standard (3-5)' },
                  { value: 'more', label: 'More (5-8)' },
                ]}
                value={dashboardKpiCount}
                onChange={setDashboardKpiCount}
              />
              <ToggleGroup
                label="Chart Preference"
                options={[
                  { value: 'mixed', label: 'Mixed' },
                  { value: 'bar', label: 'Bar' },
                  { value: 'line', label: 'Line' },
                  { value: 'pie', label: 'Pie' },
                ]}
                value={dashboardChartPreference}
                onChange={setDashboardChartPreference}
              />
              <ToggleGroup
                label="Density"
                options={[
                  { value: 'compact', label: 'Compact' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'full', label: 'Full' },
                ]}
                value={dashboardDensity}
                onChange={setDashboardDensity}
              />
            </>
          )}

          {/* Citation Graph options */}
          {toolId === 'citation-graph' && (
            <>
              <ToggleGroup
                label="Relationship Detail"
                options={[
                  { value: 'key-connections', label: 'Key Only' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'comprehensive', label: 'Comprehensive' },
                ]}
                value={citationDetail}
                onChange={setCitationDetail}
              />
              <ToggleGroup
                label="Topic Depth"
                options={[
                  { value: 'overview', label: 'Overview (1-2)' },
                  { value: 'standard', label: 'Standard (2-4)' },
                  { value: 'detailed', label: 'Detailed (4-6)' },
                ]}
                value={citationTopicDepth}
                onChange={setCitationTopicDepth}
              />
            </>
          )}

          {/* Description textarea (all tools) */}
          <div>
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
              {toolId === 'audio' ? 'Focus' : 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={placeholders[toolId] || 'Add any special instructions or focus areas...'}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>

          {/* Progress indicator */}
          {isGenerating && (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="text-indigo-500 animate-spin" />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Generating...</p>
            </div>
          )}

          {/* Generate button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
