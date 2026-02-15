import { useState } from 'react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface SlidesViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

function SlidesContent({ data }: { data: Record<string, unknown> }) {
  const deckTitle = data.title as string | undefined
  const slides = data.slides as { title: string; bullets: string[]; notes?: string }[] | undefined
  const [currentSlide, setCurrentSlide] = useState(0)

  if (!slides || slides.length === 0) return null

  const slide = slides[currentSlide]

  return (
    <div className="space-y-4">
      {deckTitle && <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{deckTitle}</h4>}

      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 min-h-[200px]">
        <h5 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">{slide.title}</h5>
        <ul className="space-y-2">
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 flex-shrink-0" />
              {bullet}
            </li>
          ))}
        </ul>
        {slide.notes && (
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">{slide.notes}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))}
          disabled={currentSlide === 0}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          &larr; Previous
        </button>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {currentSlide + 1} / {slides.length}
        </span>
        <button
          onClick={() => setCurrentSlide((s) => Math.min(slides.length - 1, s + 1))}
          disabled={currentSlide === slides.length - 1}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  )
}

export function SlidesView({ data, isFullscreen, onCloseFullscreen, title }: SlidesViewProps) {
  return (
    <>
      <SlidesContent data={data} />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title}>
        <SlidesContent data={data} />
      </FullscreenWrapper>
    </>
  )
}
