import { useState } from 'react'
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
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
        {label}
      </label>
      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              value === opt.value
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
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
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 rounded-t-2xl">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Customize {toolLabel}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Audio-specific options */}
          {toolId === 'audio' && (
            <>
              <div>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
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
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{fmt.name}</span>
                        {audioFormat === fmt.id && <Check size={14} className="text-indigo-500" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{fmt.desc}</p>
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

          {/* Description textarea (all tools) */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              {toolId === 'audio' ? 'Focus' : 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={placeholders[toolId] || 'Add any special instructions or focus areas...'}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>

          {/* Progress indicator */}
          {isGenerating && (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="text-indigo-500 animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Generating...</p>
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
    </div>
  )
}
