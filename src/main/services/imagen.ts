import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs'
import { GoogleGenAI } from '@google/genai'
import { configService } from './config'
import type { SlideStylePreset, ImageModelId } from '../../shared/types'
import { IMAGE_MODELS } from '../../shared/types'

function getMimeType(filePath: string): string {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

export const STYLE_PRESETS: SlideStylePreset[] = [
  {
    id: 'neon-circuit',
    name: 'Neon Circuit',
    description: 'Deep dark background, electric purple & neon cyan, glowing circuit traces and nodes.',
    promptSuffix:
      'with a deep dark background (#0a0a14), electric purple and neon cyan glowing accent colors, thin luminous circuit board traces connecting glowing nodes, subtle hexagonal grid pattern, holographic data visualizations, and a futuristic cyberpunk tech aesthetic. Typography is clean geometric sans-serif. All slides share this exact same deep dark background and purple-cyan neon glow consistently',
    negativePrompt: '',
    colorPalette: ['#0a0a14', '#a855f7', '#22d3ee', '#e2e8f0'],
  },
  {
    id: 'glass-morph',
    name: 'Glass Morphism',
    description: 'Frosted glass panels on dark gradient, soft glowing edges, modern UI aesthetic.',
    promptSuffix:
      'with a rich dark gradient background transitioning from deep navy (#0f172a) to deep indigo (#1e1b4b), semi-transparent frosted glass panel elements with soft white glowing edges, subtle backdrop blur effects, floating glass cards, soft ambient light reflections, and a modern premium SaaS dashboard aesthetic. Typography is thin and elegant. All slides share this exact same dark gradient background and frosted glass style consistently',
    negativePrompt: '',
    colorPalette: ['#0f172a', '#e2e8f0', '#818cf8', '#94a3b8'],
  },
  {
    id: 'gradient-mesh',
    name: 'Gradient Mesh',
    description: 'Dark navy, vibrant pink-to-blue gradient mesh blobs, startup landing page feel.',
    promptSuffix:
      'with a deep dark navy background (#0c1222), vibrant organic gradient mesh blobs transitioning from hot pink (#ec4899) through violet to electric blue (#3b82f6), soft bokeh light particles, smooth flowing abstract shapes, and a cutting-edge modern startup landing page aesthetic. Typography is bold modern geometric sans-serif. All slides share this exact same dark navy background and pink-blue gradient mesh consistently',
    negativePrompt: '',
    colorPalette: ['#0c1222', '#ec4899', '#3b82f6', '#e2e8f0'],
  },
  {
    id: 'terminal-hacker',
    name: 'Terminal',
    description: 'Near-black background, phosphor green monospace text, matrix data streams.',
    promptSuffix:
      'with a near-black background (#0a0f0a) with extremely subtle dark green grid lines, bright phosphor green (#22c55e) accent color, monospace terminal-style typography, cascading matrix-style data streams, command-line interface elements, retro CRT screen glow effect, and a hacker/developer terminal aesthetic. All slides share this exact same near-black background and bright green terminal color scheme consistently',
    negativePrompt: '',
    colorPalette: ['#0a0f0a', '#22c55e', '#4ade80', '#d1fae5'],
  },
  {
    id: 'cosmic-dark',
    name: 'Cosmic Dark',
    description: 'Deep space black, violet & rose nebula accents, starfield particles.',
    promptSuffix:
      'with a deep space black background (#06060e), violet (#8b5cf6) and rose (#f43f5e) nebula cloud accents, scattered starfield particles, soft cosmic dust, planet silhouettes, orbital ring elements, and an astronomical space exploration aesthetic. Typography is sleek and futuristic. All slides share this exact same deep space background and violet-rose nebula color scheme consistently',
    negativePrompt: '',
    colorPalette: ['#06060e', '#8b5cf6', '#f43f5e', '#e2e8f0'],
  },
  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    description: 'Cool dark slate, ice blue & white, crystalline geometric shapes.',
    promptSuffix:
      'with a cool dark slate background (#0f1729), ice blue (#38bdf8) and crisp white accent colors, crystalline geometric polygon shapes, subtle frost texture patterns, clean angular wireframe illustrations, cool-toned ambient lighting, and a modern Scandinavian tech aesthetic. Typography is clean minimal sans-serif. All slides share this exact same dark slate background and ice-blue crystalline color scheme consistently',
    negativePrompt: '',
    colorPalette: ['#0f1729', '#38bdf8', '#f8fafc', '#64748b'],
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
 * When isCustomStyle is true, avoids "presentation slide" language that biases
 * the model toward generic tech graphics, and instead frames as art-series imagery.
 */
export function buildSlidePrompt(
  slideContent: string,
  styleDescription: string,
  _layout: string = 'Centered',
  visualCue: string = '',
  isCustomStyle: boolean = false
): string {
  if (isCustomStyle) {
    return `MANDATORY VISUAL STYLE — follow this EXACTLY, do not deviate:
${styleDescription}

Generate a VISUALLY RICH, CINEMATIC presentation slide image that belongs in the same art series as described above. Match the rendering medium, color palette, saturation level, lighting, and texture PRECISELY.

${visualCue ? `PRIMARY VISUAL (this is the MOST IMPORTANT part — the image tells the story):\n${visualCue}` : ''}

The illustration/visual should dominate the slide and communicate the concept visually. It should cover most of the image area.

TEXT OVERLAY (secondary layer — keep subtle and minimal):
Render the following text on the image in a clean, elegant, understated style. The text should NOT dominate — it is a light supporting layer over the visual. Use a thin/light-weight sans-serif font, slightly transparent or with a subtle backdrop. Position it so it does not obscure the main visual. Title at top, bullet keywords below.

TEXT:
${slideContent}`
  }

  return `Generate a VISUALLY RICH, CINEMATIC presentation slide image. The visual illustration should be the dominant element — covering most of the slide and telling the story through imagery.

VISUAL STYLE (you MUST follow this precisely): ${styleDescription}.

${visualCue ? `PRIMARY VISUAL (MOST IMPORTANT — the image tells the story):\n${visualCue}` : ''}

The illustration should be vivid, evocative, and communicate the concept visually. It should cover the majority of the slide area.

TEXT OVERLAY (secondary, subtle layer):
Render the following text on the slide in a clean, elegant, understated style. Text should NOT dominate the image — it is a lightweight supporting layer for text-oriented viewers. Use a thin/light-weight sans-serif font. Keep the title compact at top, with minimal bullet keywords below. Ensure text is legible but not overpowering — the visual is the star.

TEXT:
${slideContent}`
}

/**
 * Build prompt for hybrid mode: background-only image with NO text.
 * The text will be rendered as HTML overlays on the client.
 * Content slides use a split layout: visuals concentrated on the right half.
 */
export function buildHybridSlidePrompt(
  styleDescription: string,
  visualCue: string = '',
  _layout: string = 'Centered',
  isTitleSlide: boolean = false,
  isCustomStyle: boolean = false
): string {
  if (isTitleSlide) {
    if (isCustomStyle) {
      return `MANDATORY VISUAL STYLE — follow this EXACTLY, do not deviate:
${styleDescription}

Generate a stunning, cinematic background image that looks like it belongs in the same art series as described above. This is a dramatic, atmospheric full-bleed background for a title card.

${visualCue ? `THEME: ${visualCue}` : ''}

CRITICAL: Do NOT include ANY text, letters, numbers, words, or typography in the image.
Make it visually striking with depth and mood. Match the described rendering medium, color palette, saturation level, lighting, and texture PRECISELY. The entire image should be rich and immersive.`
    }

    return `VISUAL STYLE (you MUST follow this precisely): ${styleDescription}.

Generate a stunning, cinematic presentation TITLE SLIDE background image in EXACTLY the style described above.

${visualCue ? `THEME: ${visualCue}` : ''}

CRITICAL: Do NOT include ANY text, letters, numbers, words, or typography in the image.
This is a dramatic, atmospheric full-bleed background for the opening title slide of a presentation.
Make it visually striking with depth and mood. The entire image should be rich and immersive — a centered subject or abstract composition works best.`
  }

  if (isCustomStyle) {
    return `MANDATORY VISUAL STYLE — follow this EXACTLY, do not deviate:
${styleDescription}

Generate a RICH, CINEMATIC illustration that belongs in the same art series as described above. This image is the primary storytelling element — it should visually communicate the entire concept.

${visualCue ? `VISUAL NARRATIVE (tell the story through this scene):\n${visualCue}` : ''}

LAYOUT: The visual should be expansive and immersive. Keep a subtle area on the LEFT (~30%) slightly less busy for a light text overlay, but the illustration should still feel full and cinematic — not a split-screen with an empty half.

CRITICAL: Do NOT include ANY text, letters, numbers, words, or typography. Match the described rendering medium, color palette, saturation level, lighting, and texture PRECISELY.`
  }

  return `VISUAL STYLE (you MUST follow this precisely): ${styleDescription}.

Generate a RICH, CINEMATIC presentation slide illustration in EXACTLY the style described above. This image is the primary storytelling element — it should visually communicate the entire concept to the viewer.

${visualCue ? `VISUAL NARRATIVE (tell the story through this scene):\n${visualCue}` : ''}

LAYOUT: The visual should be expansive and immersive, covering the full slide. Keep a subtle area on the LEFT (~30%) slightly less busy for a light text overlay, but the illustration should still feel full and cinematic — not a split-screen with a blank half.

CRITICAL: Do NOT include ANY text, letters, numbers, words, or typography in the image. This is the visual storytelling layer — text will be overlaid separately as a subtle secondary element.`
}

export class ImagenService {
  async generateSlideImage(
    prompt: string,
    config: {
      aspectRatio: '16:9' | '4:3'
      contentId: string
      slideNumber: number
      referenceImagePath?: string
      /** Short subject/visual cue for reference-image mode (keeps prompt minimal) */
      shortSubject?: string
      /** The style description text from describeImageStyle() — first sentence used to anchor rendering medium */
      styleHint?: string
      /** When provided, text will be rendered on the image even in reference-image mode (full-image slides) */
      slideTextContent?: string
      /** Which image model to use. Defaults to 'nano-banana-pro' (gemini-3-pro-image-preview). */
      imageModel?: ImageModelId
    }
  ): Promise<string> {
    const apiKey = configService.getApiKey()
    if (!apiKey) throw new Error('Gemini API key not configured. Please set it in Settings.')

    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 120_000 } })

    // Pre-load reference image once if provided
    let refImageBase64: string | undefined
    let refImageMime: string | undefined
    if (config.referenceImagePath) {
      try {
        refImageBase64 = readFileSync(config.referenceImagePath).toString('base64')
        refImageMime = getMimeType(config.referenceImagePath)
      } catch (err) {
        console.warn('Failed to load reference image, proceeding without:', err)
      }
    }

    const maxRetries = 2
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // When we have a reference image, use a SHORT prompt so the image signal dominates.
        // The long verbose prompt dilutes the style reference.
        let contents: string | { role: string; parts: { text?: string; inlineData?: { data: string; mimeType: string } }[] }[]
        if (refImageBase64 && refImageMime) {
          // Strip presentation/slide language from the subject — these words bias the model
          // toward a "corporate graphic" look instead of matching the reference image's style
          const rawSubject = config.shortSubject || 'an abstract atmospheric scene'
          const subject = rawSubject
            .replace(/\b(presentation|slide|deck|infographic|corporate|professional|business)\b/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim()

          let refPromptText: string
          if (config.slideTextContent) {
            // Full-image mode: match reference style BUT include slide text on the image
            refPromptText = `Generate another image like this one. Same style, same theme, same world, same atmosphere. The scene should show: ${subject}.

The visual illustration should be the DOMINANT element — rich, cinematic, covering most of the image. It should visually tell the story.

TEXT OVERLAY (secondary, subtle):
Render the following text on the image in a clean, elegant, understated style. Use a thin/light-weight font. The text should NOT dominate — it is a light supporting layer. Position it so it does not obscure the main visual.

TEXT:
${config.slideTextContent}`
          } else {
            // Background-only mode (hybrid content slides, infographics, whitepaper images): no text
            refPromptText = `Generate another image like this one. Same style, same theme, same world, same atmosphere. The scene should show: ${subject}. Make the visual rich, cinematic, and immersive — it is the primary storytelling element. No text in the image.`
          }

          contents = [
            {
              role: 'user',
              parts: [
                {
                  inlineData: { data: refImageBase64, mimeType: refImageMime },
                },
                {
                  text: refPromptText,
                },
              ],
            },
          ]
        } else {
          const currentPrompt = attempt === 0
            ? prompt
            : `Generate a presentation slide image with readable text. ${prompt.slice(0, 1200)}`
          contents = currentPrompt
        }

        const modelEntry = IMAGE_MODELS.find((m) => m.id === config.imageModel) ?? IMAGE_MODELS[0]
        const response = await ai.models.generateContent({
          model: modelEntry.geminiModel,
          contents,
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
