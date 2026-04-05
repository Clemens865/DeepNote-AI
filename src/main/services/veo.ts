import { readFileSync } from 'fs'
import { GoogleGenAI } from '@google/genai'
import { configService } from './config'
import { trackVeoCost } from './tokenTracker'
import { VEO_MODELS, type VeoModelId, type VeoResolution } from '../../shared/types'

const VEO_TIMEOUT_MS = 3 * 60 * 1000 // 3 minute timeout per call

/** Thrown when the Veo API returns 429 RESOURCE_EXHAUSTED */
export class VeoQuotaExhaustedError extends Error {
  constructor(public readonly model: string) {
    super(`Veo quota exhausted for ${model} (429 RESOURCE_EXHAUSTED). Daily limit reached.`)
    this.name = 'VeoQuotaExhaustedError'
  }
}

function getClient(): GoogleGenAI {
  const apiKey = configService.getApiKey()
  if (!apiKey) throw new Error('Gemini API key not configured. Please set it in Settings.')
  return new GoogleGenAI({ apiKey })
}

function resolveApiModel(modelId?: VeoModelId): string {
  const entry = VEO_MODELS.find((m) => m.id === modelId)
  return entry?.apiModel ?? 'veo-3.1-lite-generate-preview'
}

/** Get the fallback model API string for a given model (swap fast ↔ non-fast) */
function getFallbackApiModel(apiModel: string): string | null {
  const fallbacks: Record<string, string> = {
    'veo-3-fast-generate-preview': 'veo-3-generate-preview',
    'veo-3-generate-preview': 'veo-3-fast-generate-preview',
    'veo-3.1-generate-preview': 'veo-3.1-fast-generate-preview',
    'veo-3.1-fast-generate-preview': 'veo-3.1-generate-preview',
    'veo-3.1-lite-generate-preview': 'veo-3.1-fast-generate-preview',
  }
  return fallbacks[apiModel] ?? null
}

function getMimeType(filePath: string): string {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

/** Check if an error is a 429 quota exhausted error */
function isQuotaError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const msg = 'message' in err ? String((err as { message: string }).message) : ''
    const status = 'status' in err ? (err as { status: number }).status : 0
    return status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')
  }
  return false
}

export async function generateAnimationPrompt(imagePath: string): Promise<string> {
  const ai = getClient()
  const imageBytes = readFileSync(imagePath).toString('base64')
  const mimeType = getMimeType(imagePath)

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: imageBytes, mimeType } },
          {
            text: `You are an animation director. Analyze this infographic image and write a short animation prompt (2-3 sentences) describing how to bring it to life as a smooth, professional motion graphic. Describe camera movements, element animations, and transitions. Keep it concise and cinematic. Output ONLY the animation prompt text, nothing else.`,
          },
        ],
      },
    ],
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Failed to generate animation prompt')
  return text.trim()
}

async function callVeoImageToVideo(
  ai: GoogleGenAI,
  apiModel: string,
  prompt: string,
  imageBytes: string,
  mimeType: string,
  config: Record<string, unknown>,
  outputPath: string,
  onProgress?: (message: string) => void
): Promise<string> {
  onProgress?.(`Starting video generation with ${apiModel}...`)

  let operation = await ai.models.generateVideos({
    model: apiModel,
    prompt,
    image: { imageBytes, mimeType },
    config,
  })

  onProgress?.('Video generation in progress — polling for completion...')

  const pollStart = Date.now()
  while (!operation.done) {
    if (Date.now() - pollStart > VEO_TIMEOUT_MS) {
      throw new Error('Veo timed out after 3 minutes')
    }
    await new Promise((r) => setTimeout(r, 10_000))
    operation = await ai.operations.getVideosOperation({ operation })
    const elapsed = Math.round((Date.now() - pollStart) / 1000)
    onProgress?.(`Still generating video... (${elapsed}s)`)
  }

  console.log(`[Veo ${apiModel}] Operation complete`)

  // Check for operation-level error
  const opError = (operation as unknown as Record<string, unknown>).error
  if (opError) {
    throw new Error(`Veo operation error: ${JSON.stringify(opError)}`)
  }

  const generatedVideos = operation.response?.generatedVideos
  if (!generatedVideos || generatedVideos.length === 0) {
    throw new Error(`Veo returned no generated videos. Response: ${JSON.stringify(operation.response)}`)
  }

  const video = generatedVideos[0].video
  if (!video) {
    throw new Error(`Veo returned no video file reference. Data: ${JSON.stringify(generatedVideos[0])}`)
  }

  onProgress?.('Downloading generated video...')
  await ai.files.download({ file: video, downloadPath: outputPath })

  // Track cost based on model, duration, and resolution
  const vidDuration = config.durationSeconds ? parseInt(String(config.durationSeconds), 10) : 8
  const vidResolution = config.resolution ? String(config.resolution) : '720p'
  trackVeoCost(apiModel, vidDuration, vidResolution, 'video-generation')

  return outputPath
}

export async function animateImage(
  imagePath: string,
  prompt: string,
  outputPath: string,
  onProgress?: (message: string) => void,
  veoModel?: VeoModelId,
  veoResolution?: VeoResolution
): Promise<string> {
  const ai = getClient()
  const imageBytes = readFileSync(imagePath).toString('base64')
  const mimeType = getMimeType(imagePath)
  const primaryModel = resolveApiModel(veoModel)
  const resolution = veoResolution || '720p'

  // Build config — personGeneration is required for image-to-video
  const config: Record<string, unknown> = {
    personGeneration: 'allow_adult',
  }
  if (resolution !== '720p') {
    config.resolution = resolution
    config.durationSeconds = '8' // 1080p/4K require 8s duration (must be string)
  }

  onProgress?.(`Using ${primaryModel} (${resolution})...`)

  // Try primary model
  try {
    return await callVeoImageToVideo(ai, primaryModel, prompt, imageBytes, mimeType, config, outputPath, onProgress)
  } catch (err) {
    if (isQuotaError(err)) {
      // Try fallback model (3.1 ↔ 3.1-fast)
      const fallbackModel = getFallbackApiModel(primaryModel)
      if (fallbackModel) {
        onProgress?.(`${primaryModel} quota exhausted, trying ${fallbackModel}...`)
        console.log(`[Veo] ${primaryModel} quota exhausted, falling back to ${fallbackModel}`)
        try {
          return await callVeoImageToVideo(ai, fallbackModel, prompt, imageBytes, mimeType, config, outputPath, onProgress)
        } catch (fallbackErr) {
          if (isQuotaError(fallbackErr)) {
            throw new VeoQuotaExhaustedError(`${primaryModel} and ${fallbackModel}`)
          }
          throw fallbackErr
        }
      }
      throw new VeoQuotaExhaustedError(primaryModel)
    }
    throw err
  }
}

export async function generateVideoFromPrompt(
  prompt: string,
  outputPath: string,
  onProgress?: (message: string) => void,
  veoModel?: VeoModelId,
  veoResolution?: VeoResolution
): Promise<string> {
  const ai = getClient()
  const apiModel = resolveApiModel(veoModel)
  const resolution = veoResolution || '720p'

  onProgress?.(`Starting text-to-video generation with ${apiModel} (${resolution})...`)

  const config: Record<string, unknown> = {
    personGeneration: 'allow_all',
  }
  if (resolution !== '720p') {
    config.resolution = resolution
    config.durationSeconds = '8'
  }

  let operation = await ai.models.generateVideos({
    model: apiModel,
    prompt,
    config,
  })

  onProgress?.('Video generation in progress — polling for completion...')

  const pollStart = Date.now()
  while (!operation.done) {
    if (Date.now() - pollStart > VEO_TIMEOUT_MS) {
      throw new Error('Veo timed out after 3 minutes')
    }
    await new Promise((r) => setTimeout(r, 10_000))
    operation = await ai.operations.getVideosOperation({ operation })
    const elapsed = Math.round((Date.now() - pollStart) / 1000)
    onProgress?.(`Still generating video... (${elapsed}s)`)
  }

  const generatedVideos = operation.response?.generatedVideos
  if (!generatedVideos || generatedVideos.length === 0) {
    throw new Error('Veo returned no generated videos')
  }

  const video = generatedVideos[0].video
  if (!video) {
    throw new Error('Veo returned no video file reference')
  }

  onProgress?.('Downloading generated video...')
  await ai.files.download({ file: video, downloadPath: outputPath })

  // Track cost
  const durationSec = config.durationSeconds ? parseInt(String(config.durationSeconds), 10) : 8
  trackVeoCost(apiModel, durationSec, resolution, 'text-to-video')

  return outputPath
}
