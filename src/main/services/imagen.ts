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
  isCustomStyle: boolean = false,
  aspectRatio: string = '16:9'
): string {
  const trimmedContent = slideContent.length > 180
    ? slideContent.split('\n').filter(l => l.trim()).slice(0, 3).join('\n').slice(0, 180)
    : slideContent

  const fillRule = `COMPOSITION: The image MUST fill the entire ${aspectRatio} frame edge-to-edge with NO empty space, NO borders, NO margins, NO letterboxing. Full-bleed artwork that extends to every edge.`

  if (isCustomStyle) {
    return `MANDATORY VISUAL STYLE — follow this EXACTLY, do not deviate:
${styleDescription}

Generate a single CINEMATIC presentation slide image that belongs in the same art series as described above. Match the rendering medium, color palette, saturation level, lighting, and texture PRECISELY.

${fillRule}

${visualCue ? `SCENE AND COMPOSITION:\n${visualCue}` : ''}

INTEGRATED TEXT — the following text must be part of the image composition, not a separate overlay. Render it as typography that belongs in the scene — integrated into surfaces, environments, or as stylized display text that complements the visual. Use the style's typography aesthetic. Keep it bold and readable but woven into the art.

TEXT TO INTEGRATE:
${trimmedContent}`
  }

  return `Generate a single CINEMATIC presentation slide image where the visual and text form one unified composition — like a movie poster, editorial spread, or infographic.

VISUAL STYLE (follow precisely): ${styleDescription}.

${fillRule}

${visualCue ? `SCENE AND COMPOSITION:\n${visualCue}` : ''}

INTEGRATED TEXT — render the following text as part of the image composition. The text should feel like it belongs in the scene — as stylized display typography, integrated into the environment, or as bold graphic text that is part of the visual design. NOT a floating overlay — part of the art.

TEXT TO INTEGRATE:
${trimmedContent}`
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
  isCustomStyle: boolean = false,
  aspectRatio: string = '16:9'
): string {
  const fillRule = `COMPOSITION: The image MUST fill the entire ${aspectRatio} frame edge-to-edge with NO empty space, NO borders, NO margins, NO letterboxing. Full-bleed artwork that extends to every edge.`

  if (isTitleSlide) {
    if (isCustomStyle) {
      return `MANDATORY VISUAL STYLE — follow this EXACTLY, do not deviate:
${styleDescription}

Generate a stunning, cinematic background image that looks like it belongs in the same art series as described above. This is a dramatic, atmospheric full-bleed background for a title card.

${fillRule}

${visualCue ? `THEME: ${visualCue}` : ''}

CRITICAL: Do NOT include ANY text, letters, numbers, words, or typography in the image.
Make it visually striking with depth and mood. Match the described rendering medium, color palette, saturation level, lighting, and texture PRECISELY.`
    }

    return `VISUAL STYLE (you MUST follow this precisely): ${styleDescription}.

Generate a stunning, cinematic presentation TITLE SLIDE background image in EXACTLY the style described above.

${fillRule}

${visualCue ? `THEME: ${visualCue}` : ''}

CRITICAL: Do NOT include ANY text, letters, numbers, words, or typography in the image.
This is a dramatic, atmospheric full-bleed background. Make it visually striking with depth and mood — a centered subject or abstract composition works best.`
  }

  if (isCustomStyle) {
    return `MANDATORY VISUAL STYLE — follow this EXACTLY, do not deviate:
${styleDescription}

Generate a RICH, CINEMATIC illustration that belongs in the same art series as described above. This image is the primary storytelling element — it should visually communicate the entire concept.

${fillRule}

${visualCue ? `VISUAL NARRATIVE (tell the story through this scene):\n${visualCue}` : ''}

LAYOUT: The visual should be expansive and immersive. Keep a subtle area on the LEFT (~30%) slightly less busy for a light text overlay, but the illustration should still feel full and cinematic — not a split-screen with an empty half.

CRITICAL: Do NOT include ANY text, letters, numbers, words, or typography. Match the described rendering medium, color palette, saturation level, lighting, and texture PRECISELY.`
  }

  return `VISUAL STYLE (you MUST follow this precisely): ${styleDescription}.

Generate a RICH, CINEMATIC presentation slide illustration in EXACTLY the style described above. This image is the primary storytelling element — it should visually communicate the entire concept to the viewer.

${fillRule}

${visualCue ? `VISUAL NARRATIVE (tell the story through this scene):\n${visualCue}` : ''}

LAYOUT: The visual should be expansive and immersive, covering the full slide. Keep a subtle area on the LEFT (~30%) slightly less busy for a light text overlay, but the illustration should still feel full and cinematic — not a split-screen with a blank half.

CRITICAL: Do NOT include ANY text, letters, numbers, words, or typography in the image. This is the visual storytelling layer — text will be overlaid separately.`
}

export class ImagenService {
  async generateSlideImage(
    prompt: string,
    config: {
      aspectRatio: string
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

    // Build the list of models to try: selected model first, then fallback to nano-banana (most permissive)
    const selectedModelEntry = IMAGE_MODELS.find((m) => m.id === config.imageModel) ?? IMAGE_MODELS[0]
    const fallbackModelEntry = IMAGE_MODELS.find((m) => m.id === 'nano-banana')!
    const modelsToTry = selectedModelEntry.id !== fallbackModelEntry.id
      ? [selectedModelEntry, fallbackModelEntry]
      : [selectedModelEntry]

    let lastError: Error | null = null

    for (const modelEntry of modelsToTry) {
      const maxRetries = 2
      const isFallbackModel = modelEntry.id !== selectedModelEntry.id

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          let contents: string | { role: string; parts: { text?: string; inlineData?: { data: string; mimeType: string } }[] }[]
          if (refImageBase64 && refImageMime) {
            const rawSubject = config.shortSubject || 'an abstract atmospheric scene'
            const subject = rawSubject
              .replace(/\b(presentation|slide|deck|infographic|corporate|professional|business)\b/gi, '')
              .replace(/\s{2,}/g, ' ')
              .trim()

            let refPromptText: string
            if (config.slideTextContent && attempt === 0) {
              // Attempt 0: text integrated into the image
              const trimmedText = config.slideTextContent.length > 180
                ? config.slideTextContent.split('\n').filter(l => l.trim()).slice(0, 3).join('\n').slice(0, 180)
                : config.slideTextContent
              refPromptText = `Generate another image like this one. Same style, same theme, same world, same atmosphere. The scene should show: ${subject}.

Integrate the following text into the image as part of the visual composition — as stylized display typography that belongs in the scene, not a floating overlay. The text should be bold and readable but woven into the art.

TEXT: ${trimmedText}`
            } else if (config.slideTextContent && attempt === 1) {
              // Attempt 1: title only integrated into scene
              const titleOnly = (config.slideTextContent.split('\n').find(l => l.trim()) || subject).slice(0, 60)
              refPromptText = `Generate another image like this one. Same style, same theme, same world, same atmosphere. The scene should show: ${subject}. Integrate the title "${titleOnly}" as bold display text that is part of the visual composition.`
            } else {
              // Attempt 2+ or no-text mode: visual only, no text
              refPromptText = `Generate another image like this one. Same style, same theme, same world, same atmosphere. The scene should show: ${subject}. Make the visual rich, cinematic, and immersive. No text in the image.`
            }

            contents = [
              {
                role: 'user',
                parts: [
                  { inlineData: { data: refImageBase64, mimeType: refImageMime } },
                  { text: refPromptText },
                ],
              },
            ]
          } else {
            // No reference image — use the provided prompt with progressive simplification
            if (attempt === 0) {
              contents = prompt
            } else if (attempt === 1) {
              // Strip all bullet text, keep title + visualCue only
              const titleMatch = prompt.match(/TEXT:\n(.+?)(?:\n|$)/)
              const titleOnly = titleMatch?.[1]?.slice(0, 60) || ''
              contents = prompt.replace(/TEXT:\n[\s\S]*$/, titleOnly ? `TEXT:\n${titleOnly}` : '').slice(0, 1500)
            } else {
              // Visual-only prompt — strip all text instructions
              const visualCueMatch = prompt.match(/(?:PRIMARY VISUAL|VISUAL NARRATIVE)[^:]*:\n([\s\S]*?)(?:\n\n|TEXT|CRITICAL)/i)
              const styleMatch = prompt.match(/VISUAL STYLE[^:]*:\s*([\s\S]*?)(?:\n\n|PRIMARY|VISUAL NARRATIVE)/i)
              contents = `Generate a RICH, CINEMATIC presentation slide image. ${styleMatch?.[1]?.slice(0, 400) || ''}\n\n${visualCueMatch?.[1]?.slice(0, 300) || 'Create a visually striking abstract scene.'}\n\nDo NOT include any text in the image.`
            }
          }

          console.log(`Slide ${config.slideNumber} attempt ${attempt + 1}/${maxRetries + 1} with model ${modelEntry.geminiModel}${isFallbackModel ? ' (fallback)' : ''}`)

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
            lastError = new Error(`No response parts for slide ${config.slideNumber} (attempt ${attempt + 1}, model ${modelEntry.id})`)
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
            lastError = new Error(`No image data returned for slide ${config.slideNumber} (attempt ${attempt + 1}, model ${modelEntry.id})`)
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
          console.error(`Slide ${config.slideNumber} attempt ${attempt + 1} (model ${modelEntry.id}) failed:`, lastError.message)
          if (err && typeof err === 'object' && 'status' in err) {
            console.error('  API status:', (err as { status: unknown }).status)
          }
          if (err && typeof err === 'object' && 'errorDetails' in err) {
            console.error('  API errorDetails:', JSON.stringify((err as { errorDetails: unknown }).errorDetails))
          }
        }
      }

      if (isFallbackModel) break // don't cascade further
      console.warn(`Slide ${config.slideNumber}: all attempts with ${modelEntry.id} failed, trying fallback model...`)
    }

    throw lastError ?? new Error(`Failed to generate slide ${config.slideNumber}`)
  }
}

export const imagenService = new ImagenService()
