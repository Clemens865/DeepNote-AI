import { join } from 'path'
import { randomUUID } from 'crypto'
import { aiService } from './ai'
import { imagenService } from './imagen'
import { ttsService } from './tts'
import { animateImage } from './veo'
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
    imagePath: string
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
  const plan = await aiService.planVideoScenes(params.sourceTexts, {
    mode: params.mode,
    targetDurationSec: params.targetDurationSec,
    narrativeStyle: params.narrativeStyle || 'explain',
    moodDescription,
    audioFilePath: params.audioFilePath,
    lyricsText: params.lyricsText,
    userInstructions: params.userInstructions,
  })

  const totalScenes = plan.scenes.length
  onProgress({ stage: 'planning', message: `Planned ${totalScenes} scenes`, totalScenes })

  // Generate images (4 parallel)
  onProgress({ stage: 'images', message: 'Generating scene images...', totalScenes })
  const imageSem = new Semaphore(4)
  const scenes: StoryboardResult['scenes'] = new Array(totalScenes)

  let imagesCompleted = 0
  await Promise.all(
    plan.scenes.map(async (scene, i) => {
      await imageSem.acquire()
      try {
        const prompt = `${scene.imagePrompt}\n\nVisual style: ${styleDescription}`
        const imagePath = await imagenService.generateSlideImage(prompt, {
          aspectRatio: '16:9',
          contentId: params.notebookId,
          slideNumber: scene.sceneNumber,
          referenceImagePath: params.referenceImagePath,
          shortSubject: scene.imagePrompt.slice(0, 200),
          styleHint: params.referenceImagePath ? styleDescription : undefined,
          imageModel: params.imageModel,
          styleInfluence: params.styleInfluence,
        })
        scenes[i] = {
          sceneNumber: scene.sceneNumber,
          imagePath,
          imagePrompt: scene.imagePrompt,
          animationPrompt: scene.animationPrompt,
          narrationText: scene.narrationText,
          durationSec: scene.durationSec,
        }
        imagesCompleted++
        onProgress({
          stage: 'images',
          message: `Generated image ${imagesCompleted}/${totalScenes}`,
          currentScene: imagesCompleted,
          totalScenes,
        })
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

  onProgress({ stage: 'storyboard', message: 'Storyboard ready for review' })

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
  const { contentDir, plan, scenes } = storyboard
  const totalScenes = scenes.length

  const sceneResults: VideoOverviewResult['scenes'] = scenes.map((s) => ({
    sceneNumber: s.sceneNumber,
    imagePath: s.imagePath,
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
  await Promise.all(
    scenes.map(async (scene, i) => {
      await veoSem.acquire()
      try {
        const outputPath = join(contentDir, `scene-${scene.sceneNumber}.mp4`)
        try {
          await animateImage(
            scene.imagePath,
            scene.animationPrompt,
            outputPath,
            (msg) => onProgress({
              stage: 'animation',
              message: `Scene ${scene.sceneNumber}: ${msg}`,
              currentScene: animCompleted + 1,
              totalScenes,
            }),
            params.veoModel,
            params.veoResolution
          )
        } catch {
          veoFallbacks++
          onProgress({
            stage: 'animation',
            message: `Scene ${scene.sceneNumber}: Veo unavailable, using Ken Burns fallback...`,
            currentScene: animCompleted + 1,
            totalScenes,
          })
          await imageToVideoClip(scene.imagePath, outputPath, scene.durationSec)
        }
        sceneResults[i].videoClipPath = outputPath
        animCompleted++
        onProgress({
          stage: 'animation',
          message: `Animated ${animCompleted}/${totalScenes} scenes${veoFallbacks > 0 ? ` (${veoFallbacks} fallback)` : ''}`,
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
