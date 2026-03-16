import { join } from 'path'
import { randomUUID } from 'crypto'
import { aiService } from './ai'
import { imagenService } from './imagen'
import { ttsService } from './tts'
import { animateImage, VeoQuotaExhaustedError } from './veo'
import { assembleVideo, getVideoCacheDir, imageToVideoClip, getMediaDuration, fitAudioToDuration } from './ffmpegAssembler'
import type { ImageModelId, StyleInfluence, VeoModelId, VeoResolution } from '../../shared/types'

export interface VideoScenePlan {
  title: string
  totalDurationSec: number
  narrativeStyle: 'explain' | 'present' | 'storytell' | 'documentary'
  mood: string
  scenes: {
    sceneNumber: number
    durationSec: number
    imagePrompt: string
    animationPrompt: string
    narrationText: string
    transitionType: 'cut' | 'crossfade' | 'fade-black'
  }[]
}

export interface VideoOverviewParams {
  notebookId: string
  mode: 'overview' | 'music-video'
  targetDurationSec: number
  narrativeStyle?: 'explain' | 'present' | 'storytell' | 'documentary'
  narrationEnabled?: boolean
  moodMode: 'auto' | 'custom' | 'reference'
  moodPrompt?: string
  referenceImagePath?: string
  styleInfluence?: StyleInfluence
  stylePresetId: string
  customStyleColors?: string[]
  customStyleDescription?: string
  imageModel?: ImageModelId
  veoModel?: VeoModelId
  veoResolution?: VeoResolution
  audioFilePath?: string
  lyricsText?: string
  userInstructions?: string
  sourceTexts: string[]
}

export interface VideoProgress {
  stage: 'planning' | 'images' | 'storyboard' | 'narration' | 'animation' | 'assembly' | 'complete'
  message: string
  currentScene?: number
  totalScenes?: number
}

export interface StoryboardResult {
  contentDir: string
  plan: VideoScenePlan
  scenes: {
    sceneNumber: number
    imagePath: string | null  // null = failed, user can regenerate in review
    imagePrompt: string
    animationPrompt: string
    narrationText: string
    durationSec: number
  }[]
  moodDescription: string
  styleDescription: string
  assetName: string
}

export interface VideoOverviewResult {
  videoPath: string
  scenes: {
    sceneNumber: number
    imagePath: string
    videoClipPath: string
    audioClipPath?: string
    narrationText: string
    durationSec: number
  }[]
  totalDurationSec: number
  mode: 'overview' | 'music-video'
  narrativeStyle?: string
  moodDescription: string
  assetName: string
}

/** Limit concurrency with a simple semaphore */
class Semaphore {
  private queue: (() => void)[] = []
  private running = 0
  constructor(private max: number) {}
  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++
      return
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => { this.running++; resolve() })
    })
  }
  release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) next()
  }
}

/**
 * Phase 1: Plan scenes + generate images → return storyboard for user review.
 */
export async function generateStoryboard(
  params: VideoOverviewParams,
  onProgress: (progress: VideoProgress) => void
): Promise<StoryboardResult> {
  const contentDir = getVideoCacheDir(params.notebookId + '-' + randomUUID().slice(0, 8))

  // Resolve mood
  let moodDescription = 'cinematic, professional, visually striking'
  if (params.moodMode === 'custom' && params.moodPrompt) {
    moodDescription = params.moodPrompt
  } else if (params.moodMode === 'reference' && params.referenceImagePath) {
    onProgress({ stage: 'planning', message: 'Analyzing reference image style...' })
    moodDescription = await aiService.describeImageStyle(params.referenceImagePath)
  }

  // Resolve style description
  let styleDescription = moodDescription
  if (params.stylePresetId === 'custom-builder' && params.customStyleColors && params.customStyleDescription) {
    const [bg, primary, accent, text] = params.customStyleColors
    styleDescription = `with a ${bg} background, ${primary} as the primary accent color, ${accent} as the secondary accent color, ${text} for body text. ${params.customStyleDescription}. ${moodDescription}`
  }

  // Plan scenes
  onProgress({ stage: 'planning', message: 'Planning video scenes with AI...' })
  // Determine clip duration: 1080p/4K forces 8s, 720p defaults to 8s for consistency
  const clipDurationSec = 8

  const plan = await aiService.planVideoScenes(params.sourceTexts, {
    mode: params.mode,
    targetDurationSec: params.targetDurationSec,
    narrativeStyle: params.narrativeStyle || 'explain',
    moodDescription,
    clipDurationSec,
    audioFilePath: params.audioFilePath,
    lyricsText: params.lyricsText,
    userInstructions: params.userInstructions,
  })

  const totalScenes = plan.scenes.length
  onProgress({ stage: 'planning', message: `Planned ${totalScenes} scenes`, totalScenes })

  // Generate images (4 parallel to avoid rate limits on large batches)
  onProgress({ stage: 'images', message: `Generating ${totalScenes} scene images...`, totalScenes })
  const imageSem = new Semaphore(4)
  const scenes: StoryboardResult['scenes'] = new Array(totalScenes)

  const IMAGE_TIMEOUT_MS = 60_000 // 60s per image
  const IMAGE_MAX_RETRIES = 3

  let imagesCompleted = 0
  let imagesFailed = 0
  await Promise.all(
    plan.scenes.map(async (scene, i) => {
      await imageSem.acquire()
      try {
        const prompt = `${scene.imagePrompt}\n\nVisual style: ${styleDescription}`
        const imageOpts = {
          aspectRatio: '16:9' as const,
          contentId: params.notebookId,
          slideNumber: scene.sceneNumber,
          referenceImagePath: params.referenceImagePath,
          shortSubject: scene.imagePrompt.slice(0, 200),
          styleHint: params.referenceImagePath ? styleDescription : undefined,
          imageModel: params.imageModel,
          styleInfluence: params.styleInfluence,
        }

        let imagePath: string | null = null
        for (let attempt = 1; attempt <= IMAGE_MAX_RETRIES; attempt++) {
          try {
            imagePath = await Promise.race([
              imagenService.generateSlideImage(prompt, imageOpts),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Image generation timed out')), IMAGE_TIMEOUT_MS)
              ),
            ])
            break
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            console.error(`[Image] Scene ${scene.sceneNumber} attempt ${attempt} failed:`, errMsg)
            if (attempt < IMAGE_MAX_RETRIES) {
              onProgress({
                stage: 'images',
                message: `Scene ${scene.sceneNumber}: retry ${attempt + 1}/${IMAGE_MAX_RETRIES}...`,
                currentScene: imagesCompleted,
                totalScenes,
              })
              await new Promise((r) => setTimeout(r, 3000))
            }
            // Don't throw on last attempt — we'll set imagePath: null
          }
        }

        scenes[i] = {
          sceneNumber: scene.sceneNumber,
          imagePath,  // null if all retries failed — user can regenerate in storyboard review
          imagePrompt: scene.imagePrompt,
          animationPrompt: scene.animationPrompt,
          narrationText: scene.narrationText,
          durationSec: scene.durationSec,
        }

        if (imagePath) {
          imagesCompleted++
          onProgress({
            stage: 'images',
            message: `Generated image ${imagesCompleted}/${totalScenes}${imagesFailed > 0 ? ` (${imagesFailed} failed)` : ''}`,
            currentScene: imagesCompleted,
            totalScenes,
          })
        } else {
          imagesFailed++
          onProgress({
            stage: 'images',
            message: `Scene ${scene.sceneNumber} failed — ${imagesCompleted}/${totalScenes} done, ${imagesFailed} failed (regenerate in review)`,
            currentScene: imagesCompleted,
            totalScenes,
          })
        }
      } finally {
        imageSem.release()
      }
    })
  )

  // Build asset name
  const slug = plan.title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
    .replace(/-+$/, '')
  const date = new Date().toISOString().split('T')[0]
  const assetName = `${slug}-${params.mode === 'music-video' ? 'MusicVideo' : 'VideoOverview'}-${date}`

  const readyMsg = imagesFailed > 0
    ? `Storyboard ready — ${imagesFailed} scene${imagesFailed > 1 ? 's' : ''} failed, regenerate in review`
    : 'Storyboard ready for review'
  onProgress({ stage: 'storyboard', message: readyMsg })

  return { contentDir, plan, scenes, moodDescription, styleDescription, assetName }
}

/**
 * Regenerate a single scene image with an optional instruction.
 */
export async function regenerateSceneImage(
  scene: StoryboardResult['scenes'][0],
  styleDescription: string,
  instruction: string | undefined,
  params: { notebookId: string; referenceImagePath?: string; imageModel?: ImageModelId; styleInfluence?: StyleInfluence }
): Promise<string> {
  const basePrompt = instruction
    ? `${scene.imagePrompt}\n\nAdditional instruction: ${instruction}`
    : scene.imagePrompt
  const prompt = `${basePrompt}\n\nVisual style: ${styleDescription}`

  return imagenService.generateSlideImage(prompt, {
    aspectRatio: '16:9',
    contentId: params.notebookId,
    slideNumber: scene.sceneNumber,
    referenceImagePath: params.referenceImagePath,
    shortSubject: scene.imagePrompt.slice(0, 200),
    styleHint: params.referenceImagePath ? styleDescription : undefined,
    imageModel: params.imageModel,
    styleInfluence: params.styleInfluence,
  })
}

/**
 * Regenerate a single scene's video clip with Veo (with Ken Burns fallback).
 */
export async function regenerateSceneVideo(
  scene: { sceneNumber: number; imagePath: string; animationPrompt: string; durationSec: number },
  contentDir: string,
  instruction: string | undefined,
  params: { veoModel?: VeoModelId; veoResolution?: VeoResolution }
): Promise<string> {
  const outputPath = join(contentDir, `scene-${scene.sceneNumber}-${Date.now()}.mp4`)
  const prompt = instruction
    ? `${scene.animationPrompt}\n\nAdditional instruction: ${instruction}`
    : scene.animationPrompt

  const VEO_MAX_RETRIES = 3
  for (let attempt = 1; attempt <= VEO_MAX_RETRIES; attempt++) {
    try {
      await animateImage(scene.imagePath, prompt, outputPath, undefined, params.veoModel, params.veoResolution)
      return outputPath
    } catch (err) {
      if (err instanceof VeoQuotaExhaustedError) break
      if (attempt === VEO_MAX_RETRIES) break
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  // Fallback to Ken Burns
  await imageToVideoClip(scene.imagePath, outputPath, scene.durationSec)
  return outputPath
}

/**
 * Phase 2: Take approved storyboard → narration → animation → assembly.
 */
export async function animateStoryboard(
  storyboard: StoryboardResult,
  params: {
    mode: 'overview' | 'music-video'
    narrationEnabled?: boolean
    narrativeStyle?: string
    audioFilePath?: string
    notebookId: string
    veoModel?: VeoModelId
    veoResolution?: VeoResolution
  },
  onProgress: (progress: VideoProgress) => void
): Promise<VideoOverviewResult> {
  const { contentDir, plan } = storyboard
  // Filter out scenes with no image (failed during storyboard generation)
  const scenes = storyboard.scenes.filter((s) => s.imagePath !== null)
  const totalScenes = scenes.length

  if (totalScenes === 0) {
    throw new Error('No scenes with images to animate. Regenerate failed scenes in the storyboard review.')
  }

  const sceneResults: VideoOverviewResult['scenes'] = scenes.map((s) => ({
    sceneNumber: s.sceneNumber,
    imagePath: s.imagePath!,
    videoClipPath: '',
    narrationText: s.narrationText,
    durationSec: s.durationSec,
  }))

  // Generate narration (if enabled and overview mode)
  const narrationEnabled = params.narrationEnabled !== false && params.mode === 'overview'
  if (narrationEnabled) {
    onProgress({ stage: 'narration', message: 'Generating narration audio...', totalScenes })
    let narrCompleted = 0
    const narrSem = new Semaphore(3)
    await Promise.all(
      scenes.map(async (scene, i) => {
        if (!scene.narrationText) return
        await narrSem.acquire()
        try {
          const result = await ttsService.generateNarrationClip(
            scene.narrationText,
            undefined,
            params.narrativeStyle
          )
          sceneResults[i].audioClipPath = result.audioPath
          narrCompleted++
          onProgress({
            stage: 'narration',
            message: `Generated narration ${narrCompleted}/${totalScenes}`,
            currentScene: narrCompleted,
            totalScenes,
          })
        } finally {
          narrSem.release()
        }
      })
    )
  }

  // Animate images with Veo (2 parallel), fallback to Ken Burns
  onProgress({ stage: 'animation', message: 'Animating scenes with Veo...', totalScenes })
  const veoSem = new Semaphore(2)
  let animCompleted = 0
  let veoFallbacks = 0
  let quotaExhausted = false // When true, skip Veo entirely for remaining scenes
  await Promise.all(
    scenes.map(async (scene, i) => {
      await veoSem.acquire()
      try {
        const outputPath = join(contentDir, `scene-${scene.sceneNumber}.mp4`)

        // If quota is exhausted, go straight to Ken Burns
        if (quotaExhausted) {
          veoFallbacks++
          onProgress({
            stage: 'animation',
            message: `Scene ${scene.sceneNumber}: Veo quota exhausted, using Ken Burns...`,
            currentScene: animCompleted + 1,
            totalScenes,
          })
          await imageToVideoClip(scene.imagePath!, outputPath, scene.durationSec)
        } else {
          const VEO_MAX_RETRIES = 3
          let veoSuccess = false
          for (let attempt = 1; attempt <= VEO_MAX_RETRIES; attempt++) {
            try {
              await animateImage(
                scene.imagePath!,
                scene.animationPrompt,
                outputPath,
                (msg) => onProgress({
                  stage: 'animation',
                  message: `Scene ${scene.sceneNumber}${attempt > 1 ? ` (retry ${attempt}/${VEO_MAX_RETRIES})` : ''}: ${msg}`,
                  currentScene: animCompleted + 1,
                  totalScenes,
                }),
                params.veoModel,
                params.veoResolution
              )
              veoSuccess = true
              break
            } catch (err) {
              // On quota error, don't retry — mark exhausted so remaining scenes skip Veo
              if (err instanceof VeoQuotaExhaustedError) {
                console.error(`[Veo] Quota exhausted for scene ${scene.sceneNumber}:`, err.message)
                quotaExhausted = true
                break
              }
              const errMsg = err instanceof Error ? err.message : String(err)
              console.error(`[Veo] Scene ${scene.sceneNumber} attempt ${attempt} failed:`, errMsg)
              if (attempt < VEO_MAX_RETRIES) {
                onProgress({
                  stage: 'animation',
                  message: `Scene ${scene.sceneNumber}: attempt ${attempt} failed (${errMsg.slice(0, 80)}), retrying...`,
                  currentScene: animCompleted + 1,
                  totalScenes,
                })
                await new Promise((r) => setTimeout(r, 2000))
              }
            }
          }
          if (!veoSuccess) {
            veoFallbacks++
            const reason = quotaExhausted ? 'quota exhausted' : `failed after ${VEO_MAX_RETRIES} attempts`
            onProgress({
              stage: 'animation',
              message: `Scene ${scene.sceneNumber}: Veo ${reason}, Ken Burns fallback...`,
              currentScene: animCompleted + 1,
              totalScenes,
            })
            await imageToVideoClip(scene.imagePath!, outputPath, scene.durationSec)
          }
        }

        sceneResults[i].videoClipPath = outputPath
        animCompleted++
        const statusParts = [`Animated ${animCompleted}/${totalScenes}`]
        if (veoFallbacks > 0) statusParts.push(`${veoFallbacks} Ken Burns`)
        if (quotaExhausted) statusParts.push('quota exhausted')
        onProgress({
          stage: 'animation',
          message: statusParts.join(' · '),
          currentScene: animCompleted,
          totalScenes,
        })
      } finally {
        veoSem.release()
      }
    })
  )

  // Fit narration clips to match their video clip durations
  if (narrationEnabled) {
    onProgress({ stage: 'assembly', message: 'Syncing narration to video timing...' })
    for (let i = 0; i < sceneResults.length; i++) {
      const scene = sceneResults[i]
      if (!scene.audioClipPath || !scene.videoClipPath) continue
      try {
        const videoDuration = await getMediaDuration(scene.videoClipPath)
        const fittedPath = join(contentDir, `narr-fitted-${scene.sceneNumber}.wav`)
        await fitAudioToDuration(scene.audioClipPath, videoDuration, fittedPath)
        sceneResults[i].audioClipPath = fittedPath
      } catch {
        // If fitting fails, keep original clip — better than no audio
      }
    }
  }

  // Assemble final video
  onProgress({ stage: 'assembly', message: 'Assembling final video...' })
  const clips = sceneResults.map((s) => s.videoClipPath)
  const narrationClips = narrationEnabled
    ? sceneResults.map((s) => s.audioClipPath || null)
    : undefined

  const videoPath = await assembleVideo({
    contentId: params.notebookId,
    clips,
    narrationClips,
    musicPath: params.mode === 'music-video' ? params.audioFilePath : undefined,
    transitionType: plan.scenes[0]?.transitionType || 'cut',
    onProgress: (msg) => onProgress({ stage: 'assembly', message: msg }),
  })

  onProgress({ stage: 'complete', message: 'Video generation complete!' })

  return {
    videoPath,
    scenes: sceneResults,
    totalDurationSec: plan.totalDurationSec,
    mode: params.mode,
    narrativeStyle: plan.narrativeStyle,
    moodDescription: storyboard.moodDescription,
    assetName: storyboard.assetName,
  }
}
