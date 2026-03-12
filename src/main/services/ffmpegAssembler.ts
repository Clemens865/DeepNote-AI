import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import { randomUUID } from 'crypto'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'

// Point fluent-ffmpeg at the bundled binaries
// In packaged Electron apps, asarUnpack extracts to .asar.unpacked but the path
// still references .asar — we need to fix it so the binaries are actually executable
const ffmpegPath = ffmpegInstaller.path.replace('app.asar', 'app.asar.unpacked')
const ffprobePath = ffprobeInstaller.path.replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

function getVideoCacheDir(contentId?: string): string {
  const base = join(app.getPath('userData'), 'video-cache')
  const dir = contentId ? join(base, contentId) : base
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export interface AssembleVideoParams {
  contentId: string
  /** Ordered list of video clip paths (one per scene) */
  clips: string[]
  /** Optional narration audio clips (one per scene, same order) */
  narrationClips?: (string | null)[]
  /** Optional background music / original audio file path */
  musicPath?: string
  /** Volume for narration (0-1), default 1.0 */
  narrationVolume?: number
  /** Volume for background music (0-1), default 0.3 if narration present, 1.0 otherwise */
  musicVolume?: number
  /** Transition type between scenes */
  transitionType?: 'cut' | 'crossfade' | 'fade-black'
  /** Crossfade duration in seconds (default 0.5) */
  crossfadeDuration?: number
  onProgress?: (message: string) => void
}

export async function assembleVideo(params: AssembleVideoParams): Promise<string> {
  const {
    contentId,
    clips,
    narrationClips,
    musicPath,
    narrationVolume = 1.0,
    musicVolume,
    transitionType = 'cut',
    crossfadeDuration = 0.5,
    onProgress,
  } = params

  const cacheDir = getVideoCacheDir(contentId)
  const outputPath = join(cacheDir, `${randomUUID()}.mp4`)

  if (clips.length === 0) {
    throw new Error('No video clips provided for assembly')
  }

  // If only one clip and no audio mixing needed, just copy it
  if (clips.length === 1 && !narrationClips?.length && !musicPath) {
    const { copyFileSync } = require('fs')
    copyFileSync(clips[0], outputPath)
    return outputPath
  }

  onProgress?.('Assembling video clips...')

  // Step 1: Normalize and concatenate clips
  if (transitionType === 'cut') {
    // Normalize all clips to same format first (Veo and Ken Burns may differ)
    onProgress?.('Normalizing video clips...')
    const normalizedClips: string[] = []
    for (let i = 0; i < clips.length; i++) {
      const normPath = join(cacheDir, `norm-${i}-${randomUUID()}.mp4`)
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(clips[i])
          .videoFilters('scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1')
          .outputOptions(['-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-an', '-r', '25'])
          .output(normPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })
      normalizedClips.push(normPath)
    }

    // Concat with demuxer (now safe since all clips are identical format)
    const concatListPath = join(cacheDir, `concat-${randomUUID()}.txt`)
    const concatContent = normalizedClips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join('\n')
    writeFileSync(concatListPath, concatContent)

    const concatOutputPath = join(cacheDir, `concat-${randomUUID()}.mp4`)
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(concatOutputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    // Clean up normalized clips
    for (const np of normalizedClips) { try { unlinkSync(np) } catch { /* ignore */ } }

    // Clean up concat list
    try { unlinkSync(concatListPath) } catch { /* ignore */ }

    // Step 2: Mix narration audio if provided
    const hasNarration = narrationClips && narrationClips.some(Boolean)
    if (!hasNarration && !musicPath) {
      // No audio mixing needed — concat output is final
      const { renameSync } = require('fs')
      renameSync(concatOutputPath, outputPath)
      return outputPath
    }

    onProgress?.('Mixing audio tracks...')

    // Build narration track: concatenate narration clips with silence gaps
    let narrationTrackPath: string | undefined
    if (hasNarration && narrationClips) {
      narrationTrackPath = join(cacheDir, `narration-${randomUUID()}.wav`)
      const narrationConcatPath = join(cacheDir, `narration-concat-${randomUUID()}.txt`)
      // Create silent placeholder for scenes without narration
      const silentPath = join(cacheDir, `silence-${randomUUID()}.wav`)
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input('anullsrc=r=24000:cl=mono')
          .inputOptions(['-f', 'lavfi'])
          .duration(0.1)
          .output(silentPath)
          .outputOptions(['-ar', '24000', '-ac', '1'])
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })

      const narrationConcatContent = narrationClips
        .map((c) => `file '${(c || silentPath).replace(/'/g, "'\\''")}'`)
        .join('\n')
      writeFileSync(narrationConcatPath, narrationConcatContent)

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(narrationConcatPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .output(narrationTrackPath!)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })

      try { unlinkSync(narrationConcatPath) } catch { /* ignore */ }
      try { unlinkSync(silentPath) } catch { /* ignore */ }
    }

    // Step 3: Mix everything together
    const effectiveMusicVolume = musicVolume ?? (hasNarration ? 0.3 : 1.0)
    const cmd = ffmpeg().input(concatOutputPath)

    const filterParts: string[] = []
    let audioIndex = 1

    if (narrationTrackPath) {
      cmd.input(narrationTrackPath)
      filterParts.push(`[${audioIndex}:a]volume=${narrationVolume}[narr]`)
      audioIndex++
    }

    if (musicPath) {
      cmd.input(musicPath)
      filterParts.push(`[${audioIndex}:a]volume=${effectiveMusicVolume}[music]`)
      audioIndex++
    }

    // Build amix filter
    const audioStreams: string[] = []
    if (narrationTrackPath) audioStreams.push('[narr]')
    if (musicPath) audioStreams.push('[music]')

    if (audioStreams.length > 0) {
      if (audioStreams.length === 1) {
        filterParts.push(`${audioStreams[0]}anull[outa]`)
      } else {
        filterParts.push(`${audioStreams.join('')}amix=inputs=${audioStreams.length}:duration=first:dropout_transition=2[outa]`)
      }

      await new Promise<void>((resolve, reject) => {
        cmd
          .complexFilter(filterParts.join(';'))
          .outputOptions(['-map', '0:v', '-map', '[outa]', '-c:v', 'copy', '-c:a', 'aac', '-shortest'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })
    } else {
      // No extra audio — just use the concat output
      const { renameSync } = require('fs')
      renameSync(concatOutputPath, outputPath)
      return outputPath
    }

    // Clean up intermediate files
    try { unlinkSync(concatOutputPath) } catch { /* ignore */ }
    if (narrationTrackPath) {
      try { unlinkSync(narrationTrackPath) } catch { /* ignore */ }
    }

    return outputPath
  }

  // For crossfade/fade-black transitions: use xfade filter
  // This is more complex — build a filter chain
  onProgress?.('Applying transitions between scenes...')

  if (clips.length === 1) {
    // Single clip — no transitions
    const { copyFileSync } = require('fs')
    copyFileSync(clips[0], outputPath)
    return outputPath
  }

  // Get actual durations of each clip for correct xfade offsets
  const clipDurations: number[] = []
  for (const c of clips) {
    clipDurations.push(await getMediaDuration(c))
  }

  // Build xfade chain for crossfade/fade-black
  // First normalize all inputs to same resolution and pixel format
  const cmd = ffmpeg()
  clips.forEach((c) => cmd.input(c))

  const xfadeType = transitionType === 'crossfade' ? 'fade' : 'fadeblack'
  const filters: string[] = []

  // Normalize each input to 1920x1080 yuv420p
  for (let i = 0; i < clips.length; i++) {
    filters.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p,fps=25[norm${i}]`)
  }

  let lastOutput = '[norm0]'
  let accumulatedDuration = clipDurations[0]

  for (let i = 1; i < clips.length; i++) {
    const output = i === clips.length - 1 ? '[vout]' : `[v${i}]`
    // Offset = accumulated duration minus crossfade overlap
    const offset = Math.max(0, accumulatedDuration - crossfadeDuration)
    filters.push(`${lastOutput}[norm${i}]xfade=transition=${xfadeType}:duration=${crossfadeDuration}:offset=${offset.toFixed(2)}${output}`)
    accumulatedDuration = offset + clipDurations[i]
    lastOutput = output
  }

  await new Promise<void>((resolve, reject) => {
    cmd
      .complexFilter(filters.join(';'))
      .outputOptions(['-map', '[vout]', '-an', '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })

  // Now mix audio on top if needed (same pattern as cut mode)
  const hasNarration = narrationClips && narrationClips.some(Boolean)
  if (hasNarration || musicPath) {
    onProgress?.('Mixing audio tracks...')
    const withAudioPath = join(cacheDir, `final-${randomUUID()}.mp4`)
    const audioCmd = ffmpeg().input(outputPath)
    const audioParts: string[] = []
    let idx = 1

    if (hasNarration && narrationClips) {
      // Build a concatenated narration track
      const narrationTrackPath = join(cacheDir, `narration-${randomUUID()}.wav`)
      const narrationConcatPath = join(cacheDir, `narration-concat-${randomUUID()}.txt`)
      const silentPath = join(cacheDir, `silence-${randomUUID()}.wav`)
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input('anullsrc=r=24000:cl=mono')
          .inputOptions(['-f', 'lavfi'])
          .duration(0.1)
          .output(silentPath)
          .outputOptions(['-ar', '24000', '-ac', '1'])
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })

      const narrationConcatContent = narrationClips
        .map((c) => `file '${(c || silentPath).replace(/'/g, "'\\''")}'`)
        .join('\n')
      writeFileSync(narrationConcatPath, narrationConcatContent)

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(narrationConcatPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .output(narrationTrackPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })

      audioCmd.input(narrationTrackPath)
      audioParts.push(`[${idx}:a]volume=${narrationVolume}[narr]`)
      idx++
      try { unlinkSync(narrationConcatPath) } catch { /* ignore */ }
      try { unlinkSync(silentPath) } catch { /* ignore */ }
    }

    if (musicPath) {
      audioCmd.input(musicPath)
      const effectiveMusicVol = musicVolume ?? (hasNarration ? 0.3 : 1.0)
      audioParts.push(`[${idx}:a]volume=${effectiveMusicVol}[music]`)
      idx++
    }

    const streams: string[] = []
    if (hasNarration) streams.push('[narr]')
    if (musicPath) streams.push('[music]')

    if (streams.length === 1) {
      audioParts.push(`${streams[0]}anull[outa]`)
    } else {
      audioParts.push(`${streams.join('')}amix=inputs=${streams.length}:duration=first:dropout_transition=2[outa]`)
    }

    await new Promise<void>((resolve, reject) => {
      audioCmd
        .complexFilter(audioParts.join(';'))
        .outputOptions(['-map', '0:v', '-map', '[outa]', '-c:v', 'copy', '-c:a', 'aac', '-shortest'])
        .output(withAudioPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    // Replace output
    try { unlinkSync(outputPath) } catch { /* ignore */ }
    const { renameSync } = require('fs')
    renameSync(withAudioPath, outputPath)
  }

  return outputPath
}

/**
 * Convert a static image to a video clip with a slow Ken Burns effect.
 * Used as fallback when Veo fails for a scene.
 */
export async function imageToVideoClip(
  imagePath: string,
  outputPath: string,
  durationSec: number = 6
): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .loop(durationSec)
      .inputOptions(['-framerate', '1'])
      .complexFilter([
        `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${durationSec * 25}:s=1920x1080:fps=25`
      ])
      .outputOptions(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-t', String(durationSec)])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
  return outputPath
}

/**
 * Get the duration of a media file in seconds using ffprobe.
 */
export function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      resolve(metadata.format.duration ?? 0)
    })
  })
}

/**
 * Pad or trim an audio clip to exactly `targetDuration` seconds.
 * If the clip is shorter, silence is appended. If longer, it is trimmed.
 */
export async function fitAudioToDuration(
  audioPath: string,
  targetDuration: number,
  outputPath: string
): Promise<string> {
  const currentDuration = await getMediaDuration(audioPath)

  if (Math.abs(currentDuration - targetDuration) < 0.1) {
    // Close enough — just copy
    const { copyFileSync } = require('fs')
    copyFileSync(audioPath, outputPath)
    return outputPath
  }

  if (currentDuration > targetDuration) {
    // Trim with a short fade-out at the end
    const fadeStart = Math.max(0, targetDuration - 0.3)
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(audioPath)
        .outputOptions(['-t', String(targetDuration)])
        .audioFilters(`afade=t=out:st=${fadeStart}:d=0.3`)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })
  } else {
    // Pad with silence to reach target duration
    const silenceDuration = targetDuration - currentDuration
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(audioPath)
        .input(`anullsrc=r=24000:cl=mono`)
        .inputOptions(['-f', 'lavfi', '-t', String(silenceDuration)])
        .complexFilter('[0:a][1:a]concat=n=2:v=0:a=1[out]')
        .outputOptions(['-map', '[out]'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })
  }

  return outputPath
}

export { getVideoCacheDir }
