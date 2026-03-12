import { useState } from 'react'
import { Download, ChevronDown, ChevronRight, Clock, Film, Music } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface VideoOverviewViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

export function VideoOverviewView({ data, isFullscreen, onCloseFullscreen, title }: VideoOverviewViewProps) {
  const [showTimeline, setShowTimeline] = useState(false)

  const videoPath = data.videoPath as string | undefined
  const mode = data.mode as string | undefined
  const totalDurationSec = data.totalDurationSec as number | undefined
  const narrativeStyle = data.narrativeStyle as string | undefined
  const moodDescription = data.moodDescription as string | undefined
  const scenes = data.scenes as {
    sceneNumber: number
    imagePath: string
    videoClipPath: string
    audioClipPath?: string
    narrationText: string
    durationSec: number
  }[] | undefined
  const assetName = (data.assetName as string) || title
  const error = data.error as string | undefined

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-4">
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">Generation Failed</p>
        <p className="text-xs text-red-500 dark:text-red-400/80 mt-1">{error}</p>
      </div>
    )
  }

  if (!videoPath) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-4">
        <p className="text-sm text-amber-600 dark:text-amber-400">Video is still generating...</p>
      </div>
    )
  }

  const handleDownload = async () => {
    await window.api.studioSaveFile({
      sourcePath: videoPath,
      defaultName: `${assetName}.mp4`,
    })
  }

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const content = (
    <div className="space-y-4">
      {/* Video Player */}
      <div className="rounded-xl overflow-hidden bg-black">
        <video
          src={`local-file://${videoPath}`}
          controls
          className="w-full"
          style={{ maxHeight: isFullscreen ? '70vh' : '400px' }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <Download size={14} />
          Download MP4
        </button>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-2">
        {mode && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {mode === 'music-video' ? <Music size={12} /> : <Film size={12} />}
            <span className="capitalize">{mode.replace('-', ' ')}</span>
          </div>
        )}
        {totalDurationSec && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Clock size={12} />
            <span>{formatDuration(totalDurationSec)}</span>
          </div>
        )}
        {narrativeStyle && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
            Style: {narrativeStyle}
          </div>
        )}
        {scenes && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {scenes.length} scenes
          </div>
        )}
      </div>

      {moodDescription && (
        <div className="text-xs text-zinc-400 dark:text-zinc-500 italic">
          Mood: {moodDescription}
        </div>
      )}

      {/* Scene Timeline */}
      {scenes && scenes.length > 0 && (
        <div className="border border-black/[0.06] dark:border-white/[0.06] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
          >
            {showTimeline ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Scene Timeline ({scenes.length} scenes)
          </button>

          {showTimeline && (
            <div className="border-t border-black/[0.06] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {scenes.map((scene) => (
                <div key={scene.sceneNumber} className="flex items-start gap-3 px-4 py-3">
                  {/* Thumbnail */}
                  {scene.imagePath && (
                    <img
                      src={`local-file://${scene.imagePath}`}
                      alt={`Scene ${scene.sceneNumber}`}
                      className="w-16 h-10 rounded object-cover flex-shrink-0 bg-zinc-100 dark:bg-zinc-800"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-indigo-500">
                        Scene {scene.sceneNumber}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        {scene.durationSec}s
                      </span>
                    </div>
                    {scene.narrationText && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {scene.narrationText}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  if (isFullscreen) {
    return (
      <FullscreenWrapper isOpen={true} title={title} onClose={onCloseFullscreen}>
        {content}
      </FullscreenWrapper>
    )
  }

  return content
}
