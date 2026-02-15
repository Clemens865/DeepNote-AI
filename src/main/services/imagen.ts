import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { GoogleGenAI } from '@google/genai'
import { configService } from './config'
import type { SlideStylePreset } from '../../shared/types'

export const STYLE_PRESETS: SlideStylePreset[] = [
  {
    id: 'blueprint-dark',
    name: 'Blueprint Dark',
    description: 'Dark teal background, orange & cyan accents, technical diagrams and circuit illustrations.',
    promptSuffix:
      'with a dark teal-slate background, orange and cyan accent colors, monospace technical typography, line-art circuit diagrams, 3D cube illustrations, grid overlay, and a sci-fi command center aesthetic. All slides share this exact same dark teal background and orange-cyan color scheme consistently',
    negativePrompt: '',
    colorPalette: ['#0f2b3c', '#f97316', '#06b6d4', '#e2e8f0'],
  },
  {
    id: 'editorial-clean',
    name: 'Editorial Clean',
    description: 'Cream background, orange & blue accents, hand-drawn sketch illustrations.',
    promptSuffix:
      'with a warm cream off-white background, orange and blue accent colors, bold sans-serif headlines, hand-drawn sketch-style line illustrations, editorial infographic layouts, and a high-end magazine aesthetic. All slides share this exact same cream background and orange-blue color scheme consistently',
    negativePrompt: '',
    colorPalette: ['#faf5eb', '#ea580c', '#1e5fa6', '#18181b'],
  },
  {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    description: 'White background, navy & light blue accents, clean geometric icons.',
    promptSuffix:
      'with a clean white background, navy blue and light blue accent colors, professional sans-serif typography, clean flat geometric icons, subtle grid lines, and a polished corporate boardroom aesthetic. All slides share this exact same white background and navy-blue color scheme consistently',
    negativePrompt: '',
    colorPalette: ['#ffffff', '#1e3a5f', '#3b82f6', '#64748b'],
  },
  {
    id: 'bold-minimal',
    name: 'Bold Minimal',
    description: 'White background, black text, one bold accent color, large typography.',
    promptSuffix:
      'with a stark white background, bold black typography, one single red accent color for emphasis, extremely large display text, minimal visual elements, generous whitespace, and an Apple keynote presentation aesthetic. All slides share this exact same white-black-red color scheme consistently',
    negativePrompt: '',
    colorPalette: ['#ffffff', '#18181b', '#dc2626', '#71717a'],
  },
  {
    id: 'nature-warm',
    name: 'Nature Warm',
    description: 'Warm cream background, forest green & terracotta accents, organic leaf patterns.',
    promptSuffix:
      'with a warm cream background, forest green and terracotta accent colors, organic botanical leaf illustrations, soft natural textures, rounded shapes, and a calming sustainable education aesthetic. All slides share this exact same cream background and green-terracotta color scheme consistently',
    negativePrompt: '',
    colorPalette: ['#fef9ef', '#2d5016', '#c2410c', '#d4a76a'],
  },
  {
    id: 'dark-luxe',
    name: 'Dark Luxe',
    description: 'Black background, gold & white accents, elegant lines and subtle textures.',
    promptSuffix:
      'with a rich black background, gold metallic and white accent colors, elegant thin-line illustrations, serif typography for headings, subtle dark textures, and a premium luxury pitch deck aesthetic. All slides share this exact same black background and gold-white color scheme consistently',
    negativePrompt: '',
    colorPalette: ['#0c0c0c', '#c9a84c', '#ffffff', '#2a2a2a'],
  },
]

function getSlidesCacheDir(contentId: string): string {
  const dir = join(app.getPath('userData'), 'slides-cache', contentId)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Build the image generation prompt.
 * Structured prompt for "Nano Banana" style generation.
 */
export function buildSlidePrompt(
  slideContent: string,
  styleDescription: string,
  _layout: string = 'Centered',
  visualCue: string = ''
): string {
  return `Generate a professional presentation slide image ${styleDescription}.

${visualCue ? `ILLUSTRATION: ${visualCue}` : ''}

TEXT CONTENT (Render exactly as shown, high contrast, legible):
${slideContent}`
}

/**
 * Build prompt for hybrid mode: background-only image with NO text.
 * The text will be rendered as HTML overlays on the client.
 */
export function buildHybridSlidePrompt(
  styleDescription: string,
  visualCue: string = '',
  layout: string = 'Centered'
): string {
  let spaceInstruction = 'Leave a clear area in the center for text overlay.'
  if (layout.toLowerCase().includes('left')) {
    spaceInstruction = 'Leave clear space on the left side for text overlay.'
  } else if (layout.toLowerCase().includes('right')) {
    spaceInstruction = 'Leave clear space on the right side for text overlay.'
  } else if (layout.toLowerCase().includes('bottom')) {
    spaceInstruction = 'Leave clear space in the bottom third for text overlay.'
  }

  return `Generate a professional presentation slide BACKGROUND image ${styleDescription}.

${visualCue ? `ILLUSTRATION THEME: ${visualCue}` : ''}

CRITICAL: Do NOT include ANY text, letters, numbers, words, or typography in the image. This is a background/illustration only.
${spaceInstruction}
Generate a visually rich but text-free background suitable for a presentation slide.`
}

export class ImagenService {
  async generateSlideImage(
    prompt: string,
    config: {
      aspectRatio: '16:9' | '4:3'
      contentId: string
      slideNumber: number
    }
  ): Promise<string> {
    const apiKey = configService.getApiKey()
    if (!apiKey) throw new Error('Gemini API key not configured. Please set it in Settings.')

    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 120_000 } })

    const maxRetries = 2
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const currentPrompt = attempt === 0
          ? prompt
          : `Visualize this as a clean presentation slide: ${prompt.slice(0, 800)}`

        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: currentPrompt,
          config: {
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: config.aspectRatio,
              imageSize: '2K',
            },
            httpOptions: { timeout: 120_000 },
          },
        })

        const parts = response.candidates?.[0]?.content?.parts
        if (!parts) {
          lastError = new Error(`No response parts for slide ${config.slideNumber} (attempt ${attempt + 1})`)
          console.warn(lastError.message, '— retrying...')
          continue
        }

        let imageData: string | null = null
        for (const part of parts) {
          if (part.inlineData?.data) {
            imageData = part.inlineData.data
            break
          }
        }

        if (!imageData) {
          lastError = new Error(`No image data returned for slide ${config.slideNumber} (attempt ${attempt + 1})`)
          console.warn(lastError.message, '— retrying...')
          continue
        }

        const cacheDir = getSlidesCacheDir(config.contentId)
        const filename = `slide-${String(config.slideNumber).padStart(3, '0')}.png`
        const outputPath = join(cacheDir, filename)

        const buffer = Buffer.from(imageData, 'base64')
        writeFileSync(outputPath, buffer)

        return outputPath
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.error(`Slide ${config.slideNumber} attempt ${attempt + 1} failed:`, lastError.message)
        // Log full error details for debugging
        if (err && typeof err === 'object' && 'status' in err) {
          console.error('API error status:', (err as { status: unknown }).status)
        }
        if (err && typeof err === 'object' && 'errorDetails' in err) {
          console.error('API error details:', JSON.stringify((err as { errorDetails: unknown }).errorDetails))
        }
      }
    }

    throw lastError ?? new Error(`Failed to generate slide ${config.slideNumber}`)
  }
}

export const imagenService = new ImagenService()
