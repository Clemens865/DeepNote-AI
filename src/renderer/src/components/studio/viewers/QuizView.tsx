import { useState } from 'react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface QuizViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

function QuizContent({ data }: { data: Record<string, unknown> }) {
  const questions = data.questions as {
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }[] | undefined

  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<Record<number, number>>({})

  if (!questions) return null

  const handleSelect = (qIndex: number, oIndex: number) => {
    if (revealed.has(qIndex)) return
    setSelected((prev) => ({ ...prev, [qIndex]: oIndex }))
    setRevealed((prev) => new Set(prev).add(qIndex))
  }

  return (
    <div className="space-y-6">
      {questions.map((q, qi) => (
        <div key={qi} className="bg-black/[0.02] dark:bg-white/[0.02] rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 space-y-3">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {qi + 1}. {q.question}
          </p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const isRevealed = revealed.has(qi)
              const isSelected = selected[qi] === oi
              const isCorrect = oi === q.correctIndex

              let optionClass = 'border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300 dark:hover:border-indigo-500/50'
              if (isRevealed) {
                if (isCorrect) optionClass = 'border-green-500 bg-green-500/10'
                else if (isSelected) optionClass = 'border-red-500 bg-red-500/10'
              }

              return (
                <button
                  key={oi}
                  onClick={() => handleSelect(qi, oi)}
                  disabled={isRevealed}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${optionClass}`}
                >
                  <span className="text-zinc-700 dark:text-zinc-200">{opt}</span>
                </button>
              )
            })}
          </div>
          {revealed.has(qi) && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">{q.explanation}</p>
          )}
        </div>
      ))}
    </div>
  )
}

export function QuizView({ data, isFullscreen, onCloseFullscreen, title }: QuizViewProps) {
  return (
    <>
      <QuizContent data={data} />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title}>
        <QuizContent data={data} />
      </FullscreenWrapper>
    </>
  )
}
