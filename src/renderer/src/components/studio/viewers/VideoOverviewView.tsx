import { useState, useEffect, useRef, useCallback } from 'react'
import { Download, ChevronDown, ChevronRight, Clock, Film, Music, RefreshCw, Loader2, Play, ExternalLink } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface VideoOverviewViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
  contentId?: string
}

/**
 * Load a local file as a blob URL via IPC.
 * Returns a blob:// URL that works reliably in <video> elements.
 */
async function loadBlobUrl(filePath: string): Promise<string> {
  const { buffer, mimeType } = await window.api.studioReadFile({ filePath })
  const blob = new Blob([buffer], { type: mimeType })
  return URL.createObjectURL(blob)
}

export function VideoOverviewView({ data, isFullscreen, onCloseFullscreen, title, contentId }: VideoOverviewViewProps) {
  const [showTimeline, setShowTimeline] = useState(false)
  const [playingScene, setPlayingScene] = useState<number | null>(null)
  const [regeneratingVideo, setRegeneratingVideo] = useState<number | null>(null)
  const [regenInstruction, setRegenInstruction] = useState<Record<number, string>>({})
  const [showRegenInput, setShowRegenInput] = useState<number | null>(null)

  // Blob URL state for video playback
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const blobUrlsRef = useRef<string[]>([])

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

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  // Load the main video as blob URL when videoPath changes
  useEffect(() => {
    if (!videoPath) return
    setVideoLoading(true)
    loadBlobUrl(videoPath)
      .then((url) => {
        blobUrlsRef.current.push(url)
        setVideoBlobUrl(url)
      })
      .catch(() => setVideoBlobUrl(null))
      .finally(() => setVideoLoading(false))
  }, [videoPath])

  // Load scene video as blob URL when playingScene changes
  const [sceneBlobUrl, setSceneBlobUrl] = useState<string | null>(null)
  const [sceneLoading, setSceneLoading] = useState(false)

  useEffect(() => {
    if (playingScene === null || !scenes) {
      setSceneBlobUrl(null)
      return
    }
    const scene = scenes.find((s) => s.sceneNumber === playingScene)
    if (!scene?.videoClipPath) return
    setSceneLoading(true)
    loadBlobUrl(scene.videoClipPath)
      .then((url) => {
        blobUrlsRef.current.push(url)
        setSceneBlobUrl(url)
      })
      .catch(() => setSceneBlobUrl(null))
      .finally(() => setSceneLoading(false))
  }, [playingScene, scenes])

  const handleOpenInPlayer = useCallback(() => {
    if (videoPath) window.api.systemOpenFile({ filePath: videoPath })
  }, [videoPath])

  const handleOpenSceneInPlayer = useCallback((clipPath: string) => {
    window.api.systemOpenFile({ filePath: clipPath })
  }, [])

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

  const handleDownloadScene = async (scene: { videoClipPath: string; sceneNumber: number }) => {
    if (!scene.videoClipPath) return
    await window.api.studioSaveFile({
      sourcePath: scene.videoClipPath,
      defaultName: `${assetName}-scene-${scene.sceneNumber}.mp4`,
    })
  }

  const handleRegenerateVideo = async (sceneNumber: number) => {
    if (!contentId) return
    setRegeneratingVideo(sceneNumber)
    try {
      const result = await window.api.videoOverviewRegenVideo({
        generatedContentId: contentId,
        sceneNumber,
        instruction: regenInstruction[sceneNumber]?.trim() || undefined,
      })
      if (scenes) {
        const idx = scenes.findIndex((s) => s.sceneNumber === sceneNumber)
        if (idx !== -1) {
          scenes[idx] = { ...scenes[idx], videoClipPath: result.videoClipPath }
        }
      }
      setShowRegenInput(null)
      setRegenInstruction((prev) => { const next = { ...prev }; delete next[sceneNumber]; return next })
    } catch {
      // Error handled by UI state
    } finally {
      setRegeneratingVideo(null)
    }
  }

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const activeVideoUrl = playingScene !== null ? sceneBlobUrl : videoBlobUrl
  const isLoadingVideo = playingScene !== null ? sceneLoading : videoLoading

  const content = (
    <div className="space-y-4">
      {/* Video Player */}
      <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center" style={{ minHeight: '200px' }}>
        {isLoadingVideo ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 size={24} className="animate-spin text-indigo-400" />
            <p className="text-xs text-zinc-400">Loading video...</p>
          </div>
        ) : activeVideoUrl ? (
          <div className="relative w-full">
            <video
              key={activeVideoUrl}
              src={activeVideoUrl}
              controls
              autoPlay={playingScene !== null}
              className="w-full"
              style={{ maxHeight: isFullscreen ? '70vh' : '400px' }}
              onEnded={() => { if (playingScene !== null) setPlayingScene(null) }}
            />
            {playingScene !== null && (
              <button
                onClick={() => setPlayingScene(null)}
                className="absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded-md bg-black/70 text-white hover:bg-black/90 transition-colors"
              >
                Back to full video
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-xs text-zinc-400">Could not load video preview</p>
            <button
              onClick={handleOpenInPlayer}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <ExternalLink size={14} />
              Open in System Player
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleOpenInPlayer}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <ExternalLink size={14} />
          Open in Player
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
        >
          <Download size={14} />
          Download MP4
        </button>
        {playingScene !== null && (
          <button
            onClick={() => setPlayingScene(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
          >
            <Film size={14} />
            Full Video
          </button>
        )}
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
                <div key={scene.sceneNumber} className="px-4 py-3 space-y-2">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-24 h-14 rounded overflow-hidden flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 group">
                      {scene.imagePath && (
                        <img
                          src={`local-file://${scene.imagePath}`}
                          alt={`Scene ${scene.sceneNumber}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {scene.videoClipPath && (
                        <div
                          className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          onClick={() => setPlayingScene(scene.sceneNumber)}
                        >
                          <Play size={16} className="text-white" fill="white" />
                        </div>
                      )}
                      {playingScene === scene.sceneNumber && (
                        <div className="absolute inset-0 border-2 border-indigo-500 rounded" />
                      )}
                    </div>
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
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
                          {scene.narrationText}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Scene video actions */}
                  <div className="flex items-center gap-2 pl-[108px] flex-wrap">
                    {scene.videoClipPath && (
                      <>
                        <button
                          onClick={() => setPlayingScene(scene.sceneNumber)}
                          className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-600 font-medium"
                        >
                          <Play size={10} /> Preview
                        </button>
                        <button
                          onClick={() => handleOpenSceneInPlayer(scene.videoClipPath)}
                          className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-medium"
                        >
                          <ExternalLink size={10} /> Open
                        </button>
                        <button
                          onClick={() => handleDownloadScene(scene)}
                          className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-medium"
                        >
                          <Download size={10} /> Save
                        </button>
                      </>
                    )}
                    {regeneratingVideo === scene.sceneNumber ? (
                      <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-medium">
                        <Loader2 size={10} className="animate-spin" /> Regenerating...
                      </span>
                    ) : showRegenInput === scene.sceneNumber ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={regenInstruction[scene.sceneNumber] || ''}
                          onChange={(e) => setRegenInstruction((prev) => ({ ...prev, [scene.sceneNumber]: e.target.value }))}
                          placeholder="Optional: describe changes..."
                          className="flex-1 rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-zinc-800 text-[10px] text-zinc-700 dark:text-zinc-200 px-2 py-1 outline-none"
                        />
                        <button
                          onClick={() => handleRegenerateVideo(scene.sceneNumber)}
                          disabled={regeneratingVideo !== null}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw size={10} /> Go
                        </button>
                        <button
                          onClick={() => setShowRegenInput(null)}
                          className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowRegenInput(scene.sceneNumber)}
                        disabled={regeneratingVideo !== null}
                        className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-indigo-500 disabled:opacity-50 font-medium"
                      >
                        <RefreshCw size={10} /> Regenerate
                      </button>
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
      <FullscreenWrapper isOpen={true} title={title} onClose={onCloseFullscreen} wide>
        {content}
      </FullscreenWrapper>
    )
  }

  return content
}
