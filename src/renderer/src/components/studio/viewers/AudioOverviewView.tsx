import { useState, useRef } from 'react'
import { Play, Pause, Download } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface AudioOverviewViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

function AudioOverviewContent({ data }: { data: Record<string, unknown> }) {
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
      {audioPath && (
        <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 space-y-3">
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
                className="w-full h-1.5 rounded-full appearance-none bg-black/[0.06] dark:bg-white/[0.06] cursor-pointer accent-indigo-600 dark:accent-indigo-400"
              />
              <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
                <span>{formatTime(currentTime)}</span>
                <span>{duration ? formatTime(duration) : '0:00'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {audioPath && (
        <div className="flex justify-end">
          <button
            onClick={() => window.api.studioSaveFile({ sourcePath: audioPath, defaultName: 'audio-overview.wav' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <Download size={12} />
            Download audio
          </button>
        </div>
      )}

      {scriptTurns && scriptTurns.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Transcript</h4>
          <div className="max-h-80 overflow-auto space-y-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4">
            {scriptTurns.map((turn, i) => (
              <div key={i} className="flex gap-2">
                <span className={`text-xs font-semibold flex-shrink-0 w-16 ${speakerColors[turn.speaker] || 'text-zinc-500 dark:text-zinc-400'}`}>
                  {turn.speaker}:
                </span>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{turn.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function AudioOverviewView({ data, isFullscreen, onCloseFullscreen, title }: AudioOverviewViewProps) {
  return (
    <>
      <AudioOverviewContent data={data} />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title}>
        <AudioOverviewContent data={data} />
      </FullscreenWrapper>
    </>
  )
}
