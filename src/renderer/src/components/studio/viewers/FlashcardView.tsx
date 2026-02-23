import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface FlashcardViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

function FlashcardContent({ data }: { data: Record<string, unknown> }) {
  const cards = data.cards as { front: string; back: string; sourceRef?: string }[] | undefined
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [mastered, setMastered] = useState<Set<number>>(new Set())

  const goTo = useCallback((index: number) => {
    setIsFlipped(false)
    setCurrentIndex(index)
  }, [])

  if (!cards || cards.length === 0) return null

  const card = cards[currentIndex]
  const isMastered = mastered.has(currentIndex)

  const toggleMastered = () => {
    setMastered((prev) => {
      const next = new Set(prev)
      if (next.has(currentIndex)) next.delete(currentIndex)
      else next.add(currentIndex)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-black/[0.06] dark:bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-green-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${cards.length ? (mastered.size / cards.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0 font-medium">
          {mastered.size} / {cards.length} mastered
        </span>
      </div>

      {/* Card with 3D flip */}
      <div className="flashcard-container">
        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="w-full text-left focus:outline-none"
        >
          <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 p-[1px] rounded-2xl">
            <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
              {/* Front face */}
              <div className="flashcard-face bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 min-h-[220px] flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-indigo-500 dark:text-indigo-400 font-bold mb-3">Question</span>
                <p className="text-base text-zinc-800 dark:text-zinc-100 flex-1 flex items-center leading-relaxed">
                  {card.front}
                </p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.04]">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {currentIndex + 1} / {cards.length}
                  </span>
                  <span className="text-xs text-indigo-500 dark:text-indigo-400">Tap to reveal</span>
                </div>
              </div>

              {/* Back face */}
              <div className="flashcard-face flashcard-back bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 min-h-[220px] flex flex-col absolute inset-0">
                <span className="text-[10px] uppercase tracking-widest text-purple-500 dark:text-purple-400 font-bold mb-3">Answer</span>
                <p className="text-base text-zinc-800 dark:text-zinc-100 flex-1 flex items-center leading-relaxed">
                  {card.back}
                </p>
                {card.sourceRef && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic mt-2">{card.sourceRef}</p>
                )}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.04]">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {currentIndex + 1} / {cards.length}
                  </span>
                  <span className="text-xs text-purple-500 dark:text-purple-400">Tap to flip back</span>
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goTo(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
          Prev
        </button>

        <button
          onClick={toggleMastered}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs rounded-full font-medium transition-all ${
            isMastered
              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30'
              : 'bg-black/[0.03] dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-400 border border-black/[0.06] dark:border-white/[0.06] hover:border-green-300'
          }`}
        >
          <Check size={14} />
          {isMastered ? 'Mastered' : 'Mark as known'}
        </button>

        <button
          onClick={() => goTo(Math.min(cards.length - 1, currentIndex + 1))}
          disabled={currentIndex === cards.length - 1}
          className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

export function FlashcardView({ data, isFullscreen, onCloseFullscreen, title }: FlashcardViewProps) {
  return (
    <>
      <FlashcardContent data={data} />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title}>
        <FlashcardContent data={data} />
      </FullscreenWrapper>
    </>
  )
}
