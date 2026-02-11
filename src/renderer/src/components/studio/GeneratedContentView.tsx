import { useState, useRef } from 'react'
import type { GeneratedContent } from '@shared/types'
import { Button } from '../common/Button'
import { Play, Pause, Download } from 'lucide-react'
import { ImageSlidesView } from './ImageSlidesView'

interface GeneratedContentViewProps {
  content: GeneratedContent
  onBack: () => void
}

export function GeneratedContentView({ content, onBack }: GeneratedContentViewProps) {
  const rawData = content.data
  const data = (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) as Record<string, unknown>
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    let text: string
    if (content.type === 'report') {
      const summary = (data.summary as string) || ''
      const sections = (data.sections as { title: string; content: string }[]) || []
      text = summary + '\n\n' + sections.map((s) => `## ${s.title}\n${s.content}`).join('\n\n')
    } else {
      text = JSON.stringify(data, null, 2)
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          &larr; Back
        </Button>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">{content.title}</h3>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {content.type === 'report' && <ReportView data={data} />}
      {content.type === 'quiz' && <QuizView data={data} />}
      {content.type === 'flashcard' && <FlashcardView data={data} />}
      {content.type === 'mindmap' && <MindMapView data={data} />}
      {content.type === 'datatable' && <DataTableView data={data} />}
      {content.type === 'slides' && <SlidesView data={data} />}
      {content.type === 'image-slides' && <ImageSlidesView data={data} contentId={content.id} />}
      {content.type === 'audio' && <AudioOverviewView data={data} />}

      {data.raw != null && (
        <pre className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          {String(data.raw)}
        </pre>
      )}
    </div>
  )
}

function ReportView({ data }: { data: Record<string, unknown> }) {
  const summary = data.summary as string | undefined
  const sections = data.sections as { title: string; content: string }[] | undefined

  return (
    <div className="space-y-4">
      {summary && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg p-4">
          <p className="text-sm text-slate-800 dark:text-slate-100">{summary}</p>
        </div>
      )}
      {sections?.map((section, i) => (
        <div key={i} className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{section.title}</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{section.content}</p>
        </div>
      ))}
    </div>
  )
}

function QuizView({ data }: { data: Record<string, unknown> }) {
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
        <div key={qi} className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {qi + 1}. {q.question}
          </p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const isRevealed = revealed.has(qi)
              const isSelected = selected[qi] === oi
              const isCorrect = oi === q.correctIndex

              let optionClass = 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50'
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
                  <span className="text-slate-700 dark:text-slate-200">{opt}</span>
                </button>
              )
            })}
          </div>
          {revealed.has(qi) && (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">{q.explanation}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function FlashcardView({ data }: { data: Record<string, unknown> }) {
  const cards = data.cards as { front: string; back: string; sourceRef?: string }[] | undefined
  const [flipped, setFlipped] = useState<Set<number>>(new Set())

  if (!cards) return null

  const toggleFlip = (index: number) => {
    setFlipped((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {cards.map((card, i) => (
        <button
          key={i}
          onClick={() => toggleFlip(i)}
          className="text-left bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors"
        >
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2">
            {flipped.has(i) ? card.back : card.front}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {flipped.has(i) ? 'Answer' : 'Question'} {i + 1}/{cards.length}
            </span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400">Click to flip</span>
          </div>
          {flipped.has(i) && card.sourceRef && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">{card.sourceRef}</p>
          )}
        </button>
      ))}
    </div>
  )
}

interface MindMapBranch {
  label: string
  children?: MindMapBranch[]
}

function MindMapView({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined
  const branches = data.branches as MindMapBranch[] | undefined

  if (!branches) return null

  return (
    <div className="space-y-3">
      {title && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg px-4 py-2">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{title}</p>
        </div>
      )}
      <div className="space-y-1">
        {branches.map((branch, i) => (
          <MindMapBranchNode key={i} branch={branch} depth={0} />
        ))}
      </div>
    </div>
  )
}

function MindMapBranchNode({ branch, depth }: { branch: MindMapBranch; depth: number }) {
  const indent = depth * 20
  const colors = [
    'text-indigo-600 dark:text-indigo-400',
    'text-blue-600 dark:text-blue-400',
    'text-emerald-600 dark:text-emerald-400',
    'text-amber-600 dark:text-amber-400',
  ]
  const dotColor = colors[depth % colors.length]

  return (
    <div>
      <div className="flex items-start gap-2 py-1" style={{ paddingLeft: `${indent}px` }}>
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dotColor} bg-current`} />
        <span className="text-sm text-slate-700 dark:text-slate-200">{branch.label}</span>
      </div>
      {branch.children?.map((child, i) => (
        <MindMapBranchNode key={i} branch={child} depth={depth + 1} />
      ))}
    </div>
  )
}

function DataTableView({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined
  const columns = data.columns as string[] | undefined
  const rows = data.rows as string[][] | undefined

  if (!columns || !rows) return null

  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>}
      <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SlidesView({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined
  const slides = data.slides as { title: string; bullets: string[]; notes?: string }[] | undefined
  const [currentSlide, setCurrentSlide] = useState(0)

  if (!slides || slides.length === 0) return null

  const slide = slides[currentSlide]

  return (
    <div className="space-y-4">
      {title && <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>}

      {/* Slide card */}
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

      {/* Navigation */}
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

function AudioOverviewView({ data }: { data: Record<string, unknown> }) {
  const audioPath = data.audioPath as string | undefined
  const duration = data.duration as number | undefined
  const scriptTurns = data.scriptTurns as { speaker: string; text: string }[] | undefined
  const speakers = data.speakers as { name: string; voice: string }[] | undefined

  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleEnded = () => {
    setPlaying(false)
    setCurrentTime(0)
  }

  const speakerColors: Record<string, string> = {}
  const colorPalette = [
    'text-blue-600 dark:text-blue-400',
    'text-purple-600 dark:text-purple-400',
    'text-green-600 dark:text-green-400',
    'text-orange-600 dark:text-orange-400',
  ]
  speakers?.forEach((s, i) => {
    speakerColors[s.name] = colorPalette[i % colorPalette.length]
  })

  return (
    <div className="space-y-4">
      {/* Audio player */}
      {audioPath && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <audio
            ref={audioRef}
            src={`local-file://${audioPath}`}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors flex-shrink-0"
            >
              {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>

            <div className="flex-1 space-y-1">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 rounded-full appearance-none bg-slate-200 dark:bg-slate-700 cursor-pointer accent-indigo-600 dark:accent-indigo-400"
              />
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>{formatTime(currentTime)}</span>
                <span>{duration ? formatTime(duration) : '0:00'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download button */}
      {audioPath && (
        <div className="flex justify-end">
          <button
            onClick={() => window.api.studioSaveFile({ sourcePath: audioPath, defaultName: 'audio-overview.wav' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Download size={12} />
            Download audio
          </button>
        </div>
      )}

      {/* Transcript */}
      {scriptTurns && scriptTurns.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Transcript</h4>
          <div className="max-h-80 overflow-auto space-y-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            {scriptTurns.map((turn, i) => (
              <div key={i} className="flex gap-2">
                <span className={`text-xs font-semibold flex-shrink-0 w-16 ${speakerColors[turn.speaker] || 'text-slate-500 dark:text-slate-400'}`}>
                  {turn.speaker}:
                </span>
                <p className="text-sm text-slate-600 dark:text-slate-300">{turn.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
