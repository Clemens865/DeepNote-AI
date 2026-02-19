import { ipcMain, BrowserWindow, dialog } from 'electron'
import { copyFile, readFile, writeFile } from 'fs/promises'
import { extname } from 'path'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { aiService } from '../services/ai'
import { ttsService } from '../services/tts'
import { imagenService, STYLE_PRESETS, buildSlidePrompt, buildHybridSlidePrompt } from '../services/imagen'
import { shouldUsePipeline } from '../services/generationPipeline'
import { superbrainService } from '../services/superbrain'
import { configService } from '../services/config'

const TYPE_TITLES: Record<string, string> = {
  report: 'Report',
  quiz: 'Quiz',
  flashcard: 'Flashcards',
  mindmap: 'Mind Map',
  datatable: 'Data Table',
  slides: 'Slide Deck',
  'image-slides': 'Image Slide Deck',
  audio: 'Audio Overview',
  infographic: 'Infographic',
  dashboard: 'Dashboard',
  'literature-review': 'Literature Review',
  'competitive-analysis': 'Competitive Analysis',
  diff: 'Document Comparison',
  'citation-graph': 'Citation Graph',
  whitepaper: 'White Paper',
}

function broadcastToWindows(channel: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, data)
  })
}

export function registerStudioHandlers() {
  ipcMain.handle(IPC_CHANNELS.STUDIO_GENERATE, async (_event, args: {
    notebookId: string
    type: string
    options?: Record<string, unknown>
  }) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = randomUUID()

    // Get selected sources
    const sources = await db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.notebookId, args.notebookId))

    const selectedSources = sources.filter((s) => s.isSelected)
    if (selectedSources.length === 0) {
      throw new Error('No sources selected. Please add and select at least one source.')
    }

    const sourceIds = selectedSources.map((s) => s.id)
    const sourceTexts = selectedSources.map((s) => s.content)

    // Create record with generating status
    const record = {
      id,
      notebookId: args.notebookId,
      type: args.type as 'report' | 'quiz' | 'flashcard',
      title: `${TYPE_TITLES[args.type] || args.type} - ${new Date().toLocaleDateString()}`,
      data: JSON.stringify({}),
      sourceIds: JSON.stringify(sourceIds),
      status: 'generating' as const,
      createdAt: now,
    }
    await db.insert(schema.generatedContent).values(record)

    try {
      let generatedData: Record<string, unknown>

      if (args.type === 'audio') {
        // Special branch for audio: generate script, then synthesize audio
        const script = await aiService.generatePodcastScript(sourceTexts, args.options)
        const { audioPath, duration } = await ttsService.generatePodcastAudio(script)

        generatedData = {
          scriptTurns: script.turns,
          speakers: script.speakers,
          audioPath,
          duration,
        }
      } else {
        // Broadcast pipeline progress for complex types
        if (shouldUsePipeline(args.type)) {
          broadcastToWindows('studio:generation-progress', {
            generatedContentId: id,
            stage: 'researching',
            message: 'Researching sources...',
          })
        }
        // Generate content via AI (uses pipeline for complex types, middleware for simple)
        generatedData = await aiService.generateContent(args.type, sourceTexts, args.options)
      }

      // Update record with generated data
      await db
        .update(schema.generatedContent)
        .set({
          data: JSON.stringify(generatedData),
          status: 'completed',
        })
        .where(eq(schema.generatedContent.id, id))

      // Fire-and-forget: store generation event in SuperBrain (if enabled)
      if (configService.getAll().superbrainEnabled !== false) {
        superbrainService.remember(
          `[DeepNote Studio] Generated ${args.type}: "${record.title}" in notebook ${args.notebookId} from ${sourceIds.length} sources`,
          'semantic',
          0.5
        ).catch(() => { /* SuperBrain offline */ })
      }

      return {
        id,
        notebookId: args.notebookId,
        type: args.type,
        title: record.title,
        data: generatedData,
        sourceIds,
        status: 'completed',
        createdAt: now,
      }
    } catch (err) {
      // Update record with failed status
      await db
        .update(schema.generatedContent)
        .set({
          data: JSON.stringify({ error: err instanceof Error ? err.message : 'Generation failed' }),
          status: 'failed',
        })
        .where(eq(schema.generatedContent.id, id))

      throw new Error(`Content generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.STUDIO_STATUS, async (_event, id: string) => {
    const db = getDatabase()
    const rows = await db
      .select()
      .from(schema.generatedContent)
      .where(eq(schema.generatedContent.id, id))
    return rows[0] || null
  })

  ipcMain.handle(IPC_CHANNELS.STUDIO_LIST, async (_event, notebookId: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.generatedContent)
      .where(eq(schema.generatedContent.notebookId, notebookId))
  })

  // Delete generated content
  ipcMain.handle(IPC_CHANNELS.STUDIO_DELETE, async (_event, id: string) => {
    const db = getDatabase()
    await db.delete(schema.generatedContent).where(eq(schema.generatedContent.id, id))
  })

  // Rename generated content
  ipcMain.handle(IPC_CHANNELS.STUDIO_RENAME, async (_event, id: string, title: string) => {
    const db = getDatabase()
    await db
      .update(schema.generatedContent)
      .set({ title })
      .where(eq(schema.generatedContent.id, id))
  })

  // Save file — show save dialog and copy file to user-chosen destination
  ipcMain.handle(
    IPC_CHANNELS.STUDIO_SAVE_FILE,
    async (_event, args: { sourcePath: string; defaultName: string }) => {
      const ext = extname(args.defaultName).replace('.', '') || 'wav'
      const filterName = ext === 'png' ? 'Images' : ext === 'wav' ? 'Audio' : 'Files'

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: args.defaultName,
        filters: [{ name: filterName, extensions: [ext] }],
      })

      if (canceled || !filePath) {
        return { success: false }
      }

      await copyFile(args.sourcePath, filePath)
      return { success: true, filePath }
    }
  )

  // Suggest report formats based on sources
  ipcMain.handle(IPC_CHANNELS.STUDIO_SUGGEST_FORMATS, async (_event, notebookId: string) => {
    const db = getDatabase()
    const sources = await db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.notebookId, notebookId))

    const selectedSources = sources.filter((s) => s.isSelected)
    if (selectedSources.length === 0) return []

    const sourceTexts = selectedSources.map((s) => s.content)
    return aiService.suggestReportFormats(sourceTexts)
  })

  // Infographic — fire-and-forget pattern
  ipcMain.handle(
    IPC_CHANNELS.INFOGRAPHIC_START,
    async (_event, args: {
      notebookId: string
      stylePresetId: string
      aspectRatio: '16:9' | '4:3' | '1:1'
      userInstructions?: string
      customStyleImagePath?: string
      customStyleColors?: string[]
      customStyleDescription?: string
    }) => {
      const db = getDatabase()
      const now = new Date().toISOString()
      const generatedContentId = randomUUID()

      const sources = await db
        .select()
        .from(schema.sources)
        .where(eq(schema.sources.notebookId, args.notebookId))

      const selectedSources = sources.filter((s) => s.isSelected)
      if (selectedSources.length === 0) {
        throw new Error('No sources selected. Please add and select at least one source.')
      }

      const sourceIds = selectedSources.map((s) => s.id)
      const sourceTexts = selectedSources.map((s) => s.content)

      // Resolve style
      let styleDescription = ''
      if (args.stylePresetId === 'custom-builder' && args.customStyleColors && args.customStyleDescription) {
        const [bg, primary, accent, text] = args.customStyleColors
        styleDescription = `with a ${bg} background, ${primary} as the primary accent color, ${accent} as the secondary accent color, ${text} for body text. ${args.customStyleDescription}. All elements share this exact same color scheme and visual style consistently`
      } else {
        const preset = STYLE_PRESETS.find((p) => p.id === args.stylePresetId)
        styleDescription = preset ? preset.promptSuffix : 'with a clean, modern, professional design'
      }

      await db.insert(schema.generatedContent).values({
        id: generatedContentId,
        notebookId: args.notebookId,
        type: 'infographic' as const,
        title: `Infographic - ${new Date().toLocaleDateString()}`,
        data: {} as unknown as string,
        sourceIds: JSON.stringify(sourceIds),
        status: 'generating' as const,
        createdAt: now,
      })

      ;(async () => {
        try {
          // If custom style image was provided, extract style description
          if (args.customStyleImagePath) {
            broadcastToWindows('infographic:progress', {
              generatedContentId,
              stage: 'planning',
              message: 'Analyzing reference image style...',
            })
            styleDescription = await aiService.describeImageStyle(args.customStyleImagePath)
          }

          broadcastToWindows('infographic:progress', {
            generatedContentId,
            stage: 'planning',
            message: 'Planning infographic content...',
          })

          const plan = await aiService.planInfographic(sourceTexts)

          broadcastToWindows('infographic:progress', {
            generatedContentId,
            stage: 'generating',
            message: 'Generating infographic image...',
          })

          // Build image prompt — generate a thematic background/atmosphere image.
          // The structured text (title, key points) will be overlaid as HTML by the viewer.
          const visualElements = plan.keyPoints
            .map((kp) => kp.visualDescription)
            .join(', ')

          const userInstr = args.userInstructions ? `\nUser instructions: ${args.userInstructions}` : ''

          const imagePrompt = `Generate a rich, atmospheric, cinematic background image for an infographic about "${plan.title}". The image should evoke the theme through visual metaphors and mood — NOT through text or layout.

Visual elements to incorporate subtly: ${visualElements}

Visual style: ${styleDescription}

CRITICAL: Do NOT include ANY text, words, letters, numbers, or typography in the image. This is a pure visual background — structured text will be overlaid separately. Make it rich, immersive, and visually striking with depth, lighting, and atmosphere.${userInstr}`

          const imagePath = await imagenService.generateSlideImage(imagePrompt, {
            aspectRatio: args.aspectRatio === '1:1' ? '4:3' : args.aspectRatio,
            contentId: generatedContentId,
            slideNumber: 1,
            referenceImagePath: args.customStyleImagePath,
            shortSubject: `atmospheric background about ${plan.title}: ${visualElements.slice(0, 200)}`,
            styleHint: args.customStyleImagePath ? styleDescription : undefined,
          })

          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              data: { imagePath, plan, style: args.stylePresetId, aspectRatio: args.aspectRatio } as unknown as string,
              status: 'completed',
            })
            .where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('infographic:complete', {
            generatedContentId,
            success: true,
          })
        } catch (err) {
          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              data: {
                error: err instanceof Error ? err.message : 'Infographic generation failed',
              } as unknown as string,
              status: 'failed',
            })
            .where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('infographic:complete', {
            generatedContentId,
            success: false,
            error: err instanceof Error ? err.message : 'Infographic generation failed',
          })
        }
      })()

      return { generatedContentId }
    }
  )

  // White Paper — fire-and-forget pattern with image generation
  ipcMain.handle(
    IPC_CHANNELS.WHITEPAPER_START,
    async (_event, args: {
      notebookId: string
      tone: 'academic' | 'business' | 'technical'
      length: 'concise' | 'standard' | 'comprehensive'
      stylePresetId: string
      userInstructions?: string
      customStyleImagePath?: string
      customStyleColors?: string[]
      customStyleDescription?: string
    }) => {
      const db = getDatabase()
      const now = new Date().toISOString()
      const generatedContentId = randomUUID()

      const sources = await db
        .select()
        .from(schema.sources)
        .where(eq(schema.sources.notebookId, args.notebookId))

      const selectedSources = sources.filter((s) => s.isSelected)
      if (selectedSources.length === 0) {
        throw new Error('No sources selected. Please add and select at least one source.')
      }

      const sourceIds = selectedSources.map((s) => s.id)
      const sourceTexts = selectedSources.map((s) => s.content)

      // Resolve style
      let styleDescription = ''
      if (args.stylePresetId === 'custom-builder' && args.customStyleColors && args.customStyleDescription) {
        const [bg, primary, accent, text] = args.customStyleColors
        styleDescription = `with a ${bg} background, ${primary} as the primary accent color, ${accent} as the secondary accent color, ${text} for body text. ${args.customStyleDescription}. All elements share this exact same color scheme and visual style consistently`
      } else {
        const preset = STYLE_PRESETS.find((p) => p.id === args.stylePresetId)
        styleDescription = preset ? preset.promptSuffix : 'with a clean, modern, professional design using subtle blue and white tones'
      }

      await db.insert(schema.generatedContent).values({
        id: generatedContentId,
        notebookId: args.notebookId,
        type: 'whitepaper' as const,
        title: `White Paper - ${new Date().toLocaleDateString()}`,
        data: {} as unknown as string,
        sourceIds: JSON.stringify(sourceIds),
        status: 'generating' as const,
        createdAt: now,
      })

      ;(async () => {
        try {
          // If custom style image was provided, extract style description
          if (args.customStyleImagePath) {
            broadcastToWindows('whitepaper:progress', {
              generatedContentId,
              stage: 'planning',
              message: 'Analyzing reference image style...',
            })
            styleDescription = await aiService.describeImageStyle(args.customStyleImagePath)
          }

          // Phase A: Plan white paper content
          broadcastToWindows('whitepaper:progress', {
            generatedContentId,
            stage: 'planning',
            message: 'Planning white paper structure and content...',
          })

          const plan = await aiService.planWhitePaper(sourceTexts, {
            tone: args.tone,
            length: args.length,
            userInstructions: args.userInstructions,
          })

          // Phase B: Generate cover image
          broadcastToWindows('whitepaper:progress', {
            generatedContentId,
            stage: 'generating-cover',
            message: 'Generating cover image...',
          })

          let coverImagePath: string | undefined
          try {
            const coverPrompt = `Create an elegant, professional white paper cover illustration. Topic: "${plan.title}". Style: ${styleDescription}. The image should be sophisticated and abstract — think high-end consulting report or academic publication cover. NO text, letters, or typography in the image. Clean, minimal, professional.`
            coverImagePath = await imagenService.generateSlideImage(coverPrompt, {
              aspectRatio: '16:9',
              contentId: generatedContentId,
              slideNumber: 0,
              referenceImagePath: args.customStyleImagePath,
              shortSubject: `abstract cover for ${plan.title}`,
              styleHint: args.customStyleImagePath ? styleDescription : undefined,
            })
          } catch (err) {
            console.warn('Cover image generation failed, continuing without:', err)
          }

          // Phase C: Generate section images
          const sectionsWithImages: { number: string; title: string; content: string; imageDescription: string; imageCaption: string; imagePath?: string }[] = []
          for (let i = 0; i < plan.sections.length; i++) {
            const section = plan.sections[i]

            broadcastToWindows('whitepaper:progress', {
              generatedContentId,
              stage: 'generating-images',
              currentSection: i + 1,
              totalSections: plan.sections.length,
              message: `Generating illustration for section ${i + 1} of ${plan.sections.length}...`,
            })

            let imagePath: string | undefined
            try {
              const imagePrompt = `Create a professional illustration for a white paper section. ${section.imageDescription}. Visual style: ${styleDescription}. Make it look like a professional figure in a high-quality publication. NO text, letters, or typography in the image.`
              imagePath = await imagenService.generateSlideImage(imagePrompt, {
                aspectRatio: '16:9',
                contentId: generatedContentId,
                slideNumber: i + 1,
                referenceImagePath: args.customStyleImagePath,
                shortSubject: section.imageDescription.slice(0, 100),
                styleHint: args.customStyleImagePath ? styleDescription : undefined,
              })
            } catch (err) {
              console.warn(`Section ${i + 1} image failed, continuing without:`, err)
            }

            sectionsWithImages.push({
              ...section,
              imagePath,
            })
          }

          // Save completed white paper
          const currentDb = getDatabase()
          const wpData = {
            title: plan.title,
            subtitle: plan.subtitle,
            abstract: plan.abstract,
            date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            tableOfContents: plan.tableOfContents,
            sections: sectionsWithImages,
            references: plan.references,
            keyFindings: plan.keyFindings,
            conclusion: plan.conclusion,
            coverImagePath,
            style: args.stylePresetId,
          }

          await currentDb
            .update(schema.generatedContent)
            .set({
              title: `White Paper: ${plan.title}`,
              data: wpData as unknown as string,
              status: 'completed',
            })
            .where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('whitepaper:complete', {
            generatedContentId,
            success: true,
          })
        } catch (err) {
          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              data: {
                error: err instanceof Error ? err.message : 'White paper generation failed',
              } as unknown as string,
              status: 'failed',
            })
            .where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('whitepaper:complete', {
            generatedContentId,
            success: false,
            error: err instanceof Error ? err.message : 'White paper generation failed',
          })
        }
      })()

      return { generatedContentId }
    }
  )

  // Image Slides — fire-and-forget pattern (like deep research)
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_SLIDES_START,
    async (_event, args: {
      notebookId: string
      stylePresetId: string
      format: 'presentation' | 'pitch' | 'report'
      length: 'test' | 'short' | 'default'
      aspectRatio: '16:9' | '4:3'
      userInstructions?: string
      customStyleImagePath?: string
      renderMode?: 'full-image' | 'hybrid'
      customStyleColors?: string[]
      customStyleDescription?: string
    }) => {
      const renderMode = args.renderMode || 'full-image'
      const db = getDatabase()
      const now = new Date().toISOString()
      const generatedContentId = randomUUID()

      // Get selected sources
      const sources = await db
        .select()
        .from(schema.sources)
        .where(eq(schema.sources.notebookId, args.notebookId))

      const selectedSources = sources.filter((s) => s.isSelected)
      if (selectedSources.length === 0) {
        throw new Error('No sources selected. Please add and select at least one source.')
      }

      const sourceIds = selectedSources.map((s) => s.id)
      const sourceTexts = selectedSources.map((s) => s.content)

      // Find style preset (or build custom)
      let stylePreset: { promptSuffix: string; colorPalette: string[] } | undefined
      if (args.stylePresetId === 'custom-builder' && args.customStyleColors && args.customStyleDescription) {
        const [bg, primary, accent, text] = args.customStyleColors
        stylePreset = {
          promptSuffix: `with a ${bg} background, ${primary} as the primary accent color, ${accent} as the secondary accent color, ${text} for body text. ${args.customStyleDescription}. All slides share this exact same color scheme and visual style consistently`,
          colorPalette: args.customStyleColors,
        }
      } else {
        stylePreset = STYLE_PRESETS.find((p) => p.id === args.stylePresetId)
      }
      if (!stylePreset) {
        throw new Error(`Unknown style preset: ${args.stylePresetId}`)
      }

      // Create DB record immediately (pass raw objects — Drizzle json mode handles serialization)
      await db.insert(schema.generatedContent).values({
        id: generatedContentId,
        notebookId: args.notebookId,
        type: 'image-slides' as const,
        title: `Image Slide Deck - ${new Date().toLocaleDateString()}`,
        data: {} as unknown as string,
        sourceIds: JSON.stringify(sourceIds),
        status: 'generating' as const,
        createdAt: now,
      })

      // Fire-and-forget async pipeline
      ;(async () => {
        try {
          // If custom style image was provided, extract style description
          let styleDescription = stylePreset!.promptSuffix
          if (args.customStyleImagePath) {
            broadcastToWindows('image-slides:progress', {
              generatedContentId,
              stage: 'planning',
              message: 'Analyzing reference image style...',
            })
            styleDescription = await aiService.describeImageStyle(args.customStyleImagePath)
          }

          // Phase A: Plan slide content (text only — no image prompts)
          broadcastToWindows('image-slides:progress', {
            generatedContentId,
            stage: 'planning',
            message: 'Planning slide content...',
          })

          const slideCount = args.length === 'test' ? 3 : args.length === 'short' ? 5 : 10

          const contentPlan = await aiService.planImageSlides(
            sourceTexts,
            slideCount,
            args.format,
            args.userInstructions,
            renderMode
          )

          // Phase B: Generate each slide image
          const slides: { slideNumber: number; title: string; bullets: string[]; imagePath: string; speakerNotes: string }[] = []
          const hybridSlides: { slideNumber: number; title: string; bullets: string[]; imagePath: string; speakerNotes: string; layout: string; elementLayout?: { type: string; content: string; x: number; y: number; width: number; fontSize: number; align: string }[] }[] = []

          for (const plan of contentPlan) {
            broadcastToWindows('image-slides:progress', {
              generatedContentId,
              stage: 'generating',
              currentSlide: plan.slideNumber,
              totalSlides: contentPlan.length,
              message: `Generating slide ${plan.slideNumber} of ${contentPlan.length}...`,
            })

            // Ensure content field is never empty — fallback to title + bullets
            const slideContent = (plan.content && plan.content.trim())
              ? plan.content
              : [plan.title, '', ...(plan.bullets || [])].join('\n')

            try {
              let prompt: string
              const isTitleSlide = plan.slideNumber === 1
              const isCustomStyle = !!args.customStyleImagePath
              if (renderMode === 'hybrid') {
                if (isTitleSlide) {
                  // Title slide: generate full image with text baked in (like full-image mode)
                  prompt = buildSlidePrompt(
                    slideContent,
                    styleDescription,
                    plan.layout,
                    plan.visualCue,
                    isCustomStyle
                  )
                } else {
                  prompt = buildHybridSlidePrompt(
                    styleDescription,
                    plan.visualCue,
                    plan.layout,
                    false,
                    isCustomStyle
                  )
                }
              } else {
                prompt = buildSlidePrompt(
                  slideContent,
                  styleDescription,
                  plan.layout,
                  plan.visualCue,
                  isCustomStyle
                )
              }

              // Pass slideTextContent when text should be baked into the image
              // (full-image mode always, hybrid mode only for title slide)
              const needsTextOnImage = renderMode === 'full-image' || (renderMode === 'hybrid' && isTitleSlide)

              const imagePath = await imagenService.generateSlideImage(prompt, {
                aspectRatio: args.aspectRatio,
                contentId: generatedContentId,
                slideNumber: plan.slideNumber,
                referenceImagePath: args.customStyleImagePath,
                shortSubject: plan.visualCue || plan.title,
                styleHint: isCustomStyle ? styleDescription : undefined,
                slideTextContent: needsTextOnImage ? slideContent : undefined,
              })

              if (renderMode === 'hybrid') {
                hybridSlides.push({
                  slideNumber: plan.slideNumber,
                  title: plan.title,
                  bullets: plan.bullets,
                  imagePath,
                  speakerNotes: plan.speakerNotes,
                  layout: plan.layout,
                  ...(plan.elementLayout ? { elementLayout: plan.elementLayout } : {}),
                })
              } else {
                slides.push({
                  slideNumber: plan.slideNumber,
                  title: plan.title,
                  bullets: plan.bullets,
                  imagePath,
                  speakerNotes: plan.speakerNotes,
                })
              }
            } catch (slideErr) {
              console.warn(`Skipping slide ${plan.slideNumber}:`, slideErr instanceof Error ? slideErr.message : slideErr)
              broadcastToWindows('image-slides:progress', {
                generatedContentId,
                stage: 'generating',
                currentSlide: plan.slideNumber,
                totalSlides: contentPlan.length,
                message: `Slide ${plan.slideNumber} failed, continuing...`,
              })
            }
          }

          const totalGenerated = renderMode === 'hybrid' ? hybridSlides.length : slides.length
          if (totalGenerated === 0) {
            throw new Error('All slide images failed to generate. Please try again with a different style or simpler content.')
          }

          // Update DB with completed data (pass raw object — Drizzle json mode handles serialization)
          const currentDb = getDatabase()
          const dbData: Record<string, unknown> = {
            style: args.stylePresetId,
            aspectRatio: args.aspectRatio,
            totalSlides: totalGenerated,
            contentPlan,
            renderMode,
            ...(args.stylePresetId === 'custom-builder' && args.customStyleColors
              ? { customPalette: args.customStyleColors }
              : {}),
          }
          if (renderMode === 'hybrid') {
            dbData.hybridSlides = hybridSlides
            dbData.slides = []
          } else {
            dbData.slides = slides
          }

          await currentDb
            .update(schema.generatedContent)
            .set({
              data: dbData as unknown as string,
              status: 'completed',
            })
            .where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('image-slides:complete', {
            generatedContentId,
            success: true,
          })
        } catch (err) {
          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              data: {
                error: err instanceof Error ? err.message : 'Image slides generation failed',
              } as unknown as string,
              status: 'failed',
            })
            .where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('image-slides:complete', {
            generatedContentId,
            success: false,
            error: err instanceof Error ? err.message : 'Image slides generation failed',
          })
        }
      })()

      return { generatedContentId }
    }
  )

  // Image Slides — update text for hybrid mode (editable overlays)
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_SLIDES_UPDATE_TEXT,
    async (_event, args: { generatedContentId: string; slideNumber: number; title: string; bullets: string[]; elements?: unknown[] }) => {
      const db = getDatabase()
      const rows = await db
        .select()
        .from(schema.generatedContent)
        .where(eq(schema.generatedContent.id, args.generatedContentId))

      const row = rows[0]
      if (!row) throw new Error('Generated content not found')

      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      const hybridSlides = data.hybridSlides as { slideNumber: number; title: string; bullets: string[]; imagePath: string; speakerNotes: string; layout: string; elements?: unknown[] }[] | undefined
      if (!hybridSlides) throw new Error('No hybrid slides data found')

      const slideIdx = hybridSlides.findIndex((s) => s.slideNumber === args.slideNumber)
      if (slideIdx === -1) throw new Error(`Slide ${args.slideNumber} not found`)

      hybridSlides[slideIdx].title = args.title
      hybridSlides[slideIdx].bullets = args.bullets
      if (args.elements) {
        hybridSlides[slideIdx].elements = args.elements
      }
      data.hybridSlides = hybridSlides

      await db
        .update(schema.generatedContent)
        .set({ data: data as unknown as string })
        .where(eq(schema.generatedContent.id, args.generatedContentId))
    }
  )

  // Export White Paper as A4 PDF
  ipcMain.handle(
    IPC_CHANNELS.WHITEPAPER_EXPORT_PDF,
    async (_event, args: {
      title: string
      subtitle: string
      abstract: string
      date: string
      sections: { number: string; title: string; content: string; imagePath?: string; imageCaption?: string }[]
      references: { number: number; citation: string }[]
      keyFindings: string[]
      conclusion: string
      coverImagePath?: string
      defaultName: string
    }) => {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: args.defaultName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })

      if (canceled || !filePath) {
        return { success: false }
      }

      const pdfDoc = await PDFDocument.create()
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

      // A4 dimensions in points (72pt/inch): 595.28 x 841.89
      const A4_WIDTH = 595.28
      const A4_HEIGHT = 841.89
      const MARGIN = 56 // ~20mm margins
      const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN
      const FOOTER_HEIGHT = 30

      const colors = {
        title: rgb(0.15, 0.15, 0.25),
        heading: rgb(0.2, 0.2, 0.35),
        body: rgb(0.25, 0.25, 0.3),
        accent: rgb(0.31, 0.35, 0.87), // indigo
        light: rgb(0.55, 0.55, 0.6),
        rule: rgb(0.85, 0.85, 0.88),
      }

      let currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
      let y = A4_HEIGHT - MARGIN
      let pageNum = 1

      // Helper: ensure space, add new page if needed
      function ensureSpace(needed: number): void {
        if (y - needed < MARGIN + FOOTER_HEIGHT) {
          drawFooter()
          currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
          y = A4_HEIGHT - MARGIN
          pageNum++
        }
      }

      // Helper: draw page footer
      function drawFooter(): void {
        const pageText = `${pageNum}`
        const textWidth = fontRegular.widthOfTextAtSize(pageText, 8)
        currentPage.drawText(pageText, {
          x: A4_WIDTH / 2 - textWidth / 2,
          y: MARGIN / 2,
          size: 8,
          font: fontRegular,
          color: colors.light,
        })
      }

      // Helper: word-wrap text and draw it, returns final y position
      function drawWrappedText(
        text: string,
        opts: { x: number; size: number; font: typeof fontRegular; color: ReturnType<typeof rgb>; lineHeight?: number; indent?: number }
      ): number {
        const lineHeight = opts.lineHeight || opts.size * 1.5
        const maxWidth = CONTENT_WIDTH - (opts.indent || 0)
        const words = text.split(/\s+/)
        let line = ''

        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word
          const testWidth = opts.font.widthOfTextAtSize(testLine, opts.size)
          if (testWidth > maxWidth && line) {
            ensureSpace(lineHeight)
            currentPage.drawText(line, { x: opts.x, y, size: opts.size, font: opts.font, color: opts.color })
            y -= lineHeight
            line = word
          } else {
            line = testLine
          }
        }
        if (line) {
          ensureSpace(lineHeight)
          currentPage.drawText(line, { x: opts.x, y, size: opts.size, font: opts.font, color: opts.color })
          y -= lineHeight
        }
        return y
      }

      // Helper: strip markdown formatting for plain text PDF
      function stripMarkdown(md: string): string {
        return md
          .replace(/#{1,6}\s+/g, '')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/`(.+?)`/g, '$1')
          .replace(/\[(.+?)\]\(.+?\)/g, '$1')
          .replace(/^[-*+]\s+/gm, '  - ')
          .replace(/^\d+\.\s+/gm, (m) => `  ${m}`)
          .replace(/^>\s+/gm, '  ')
          .replace(/\n{3,}/g, '\n\n')
      }

      // Helper: embed image
      async function embedImage(imgPath: string): Promise<{ image: Awaited<ReturnType<typeof pdfDoc.embedPng>>; width: number; height: number } | null> {
        try {
          const imgBytes = await readFile(imgPath)
          const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50 && imgBytes[2] === 0x4e && imgBytes[3] === 0x47
          const isJpeg = imgBytes[0] === 0xff && imgBytes[1] === 0xd8
          let image
          if (isPng) {
            image = await pdfDoc.embedPng(imgBytes)
          } else if (isJpeg) {
            image = await pdfDoc.embedJpg(imgBytes)
          } else {
            try { image = await pdfDoc.embedPng(imgBytes) } catch { image = await pdfDoc.embedJpg(imgBytes) }
          }
          const { width, height } = image.scale(1)
          return { image, width, height }
        } catch (err) {
          console.warn('Failed to embed image:', imgPath, err)
          return null
        }
      }

      // ===== COVER PAGE =====
      if (args.coverImagePath) {
        const cover = await embedImage(args.coverImagePath)
        if (cover) {
          const imgMaxWidth = CONTENT_WIDTH
          const scale = Math.min(imgMaxWidth / cover.width, 200 / cover.height)
          const imgW = cover.width * scale
          const imgH = cover.height * scale
          ensureSpace(imgH + 20)
          y -= 20
          currentPage.drawImage(cover.image, { x: MARGIN + (CONTENT_WIDTH - imgW) / 2, y: y - imgH, width: imgW, height: imgH })
          y -= imgH + 20
        }
      }

      // Title
      y -= 30
      drawWrappedText(args.title, { x: MARGIN, size: 24, font: fontBold, color: colors.title, lineHeight: 30 })
      y -= 6

      // Subtitle
      if (args.subtitle) {
        drawWrappedText(args.subtitle, { x: MARGIN, size: 13, font: fontItalic, color: colors.light, lineHeight: 18 })
      }
      y -= 6

      // Date
      if (args.date) {
        drawWrappedText(args.date, { x: MARGIN, size: 10, font: fontRegular, color: colors.light })
      }

      // Divider
      y -= 12
      ensureSpace(2)
      currentPage.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: 0.5, color: colors.rule })
      y -= 20

      // ===== ABSTRACT =====
      if (args.abstract) {
        ensureSpace(30)
        drawWrappedText('ABSTRACT', { x: MARGIN, size: 9, font: fontBold, color: colors.accent, lineHeight: 14 })
        y -= 4
        drawWrappedText(args.abstract, { x: MARGIN, size: 10, font: fontRegular, color: colors.body, lineHeight: 15 })
        y -= 16
      }

      // ===== KEY FINDINGS =====
      if (args.keyFindings.length > 0) {
        ensureSpace(30)
        drawWrappedText('KEY FINDINGS', { x: MARGIN, size: 9, font: fontBold, color: colors.accent, lineHeight: 14 })
        y -= 4
        for (const finding of args.keyFindings) {
          ensureSpace(16)
          drawWrappedText(`\u2022  ${finding}`, { x: MARGIN + 8, size: 10, font: fontRegular, color: colors.body, lineHeight: 14, indent: 8 })
          y -= 2
        }
        y -= 12
      }

      // ===== TABLE OF CONTENTS =====
      ensureSpace(30)
      drawWrappedText('TABLE OF CONTENTS', { x: MARGIN, size: 9, font: fontBold, color: colors.accent, lineHeight: 14 })
      y -= 4
      for (const section of args.sections) {
        ensureSpace(16)
        drawWrappedText(`${section.number}.  ${section.title}`, { x: MARGIN + 8, size: 10, font: fontRegular, color: colors.body, lineHeight: 14 })
      }
      ensureSpace(16)
      drawWrappedText('Conclusion', { x: MARGIN + 8, size: 10, font: fontItalic, color: colors.light, lineHeight: 14 })
      if (args.references.length > 0) {
        ensureSpace(16)
        drawWrappedText('References', { x: MARGIN + 8, size: 10, font: fontItalic, color: colors.light, lineHeight: 14 })
      }
      y -= 16

      // ===== SECTIONS =====
      for (const section of args.sections) {
        // Start each section on a new page if less than 30% space remains
        if (y < A4_HEIGHT * 0.3) {
          drawFooter()
          currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
          y = A4_HEIGHT - MARGIN
          pageNum++
        }

        // Section heading
        ensureSpace(30)
        drawWrappedText(`${section.number}. ${section.title}`, { x: MARGIN, size: 15, font: fontBold, color: colors.heading, lineHeight: 20 })
        y -= 6

        // Divider under heading
        ensureSpace(2)
        currentPage.drawRectangle({ x: MARGIN, y: y + 4, width: CONTENT_WIDTH, height: 0.5, color: colors.rule })
        y -= 8

        // Section image
        if (section.imagePath) {
          const img = await embedImage(section.imagePath)
          if (img) {
            const imgMaxWidth = CONTENT_WIDTH - 40
            const imgMaxHeight = 220
            const scale = Math.min(imgMaxWidth / img.width, imgMaxHeight / img.height)
            const imgW = img.width * scale
            const imgH = img.height * scale
            ensureSpace(imgH + 30)
            const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2
            currentPage.drawImage(img.image, { x: imgX, y: y - imgH, width: imgW, height: imgH })
            y -= imgH + 6
            if (section.imageCaption) {
              drawWrappedText(section.imageCaption, { x: MARGIN + 20, size: 8, font: fontItalic, color: colors.light, lineHeight: 11, indent: 40 })
            }
            y -= 10
          }
        }

        // Section content paragraphs
        const plainText = stripMarkdown(section.content)
        const paragraphs = plainText.split(/\n\n+/)
        for (const para of paragraphs) {
          const trimmed = para.trim()
          if (!trimmed) continue
          drawWrappedText(trimmed, { x: MARGIN, size: 10, font: fontRegular, color: colors.body, lineHeight: 15 })
          y -= 8
        }
        y -= 8
      }

      // ===== CONCLUSION =====
      if (args.conclusion) {
        if (y < A4_HEIGHT * 0.3) {
          drawFooter()
          currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
          y = A4_HEIGHT - MARGIN
          pageNum++
        }

        ensureSpace(30)
        drawWrappedText('Conclusion', { x: MARGIN, size: 15, font: fontBold, color: colors.heading, lineHeight: 20 })
        y -= 6
        currentPage.drawRectangle({ x: MARGIN, y: y + 4, width: CONTENT_WIDTH, height: 0.5, color: colors.rule })
        y -= 8

        const plainConclusion = stripMarkdown(args.conclusion)
        const paragraphs = plainConclusion.split(/\n\n+/)
        for (const para of paragraphs) {
          const trimmed = para.trim()
          if (!trimmed) continue
          drawWrappedText(trimmed, { x: MARGIN, size: 10, font: fontRegular, color: colors.body, lineHeight: 15 })
          y -= 8
        }
        y -= 8
      }

      // ===== REFERENCES =====
      if (args.references.length > 0) {
        if (y < A4_HEIGHT * 0.3) {
          drawFooter()
          currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
          y = A4_HEIGHT - MARGIN
          pageNum++
        }

        ensureSpace(30)
        drawWrappedText('References', { x: MARGIN, size: 15, font: fontBold, color: colors.heading, lineHeight: 20 })
        y -= 6
        currentPage.drawRectangle({ x: MARGIN, y: y + 4, width: CONTENT_WIDTH, height: 0.5, color: colors.rule })
        y -= 8

        for (const ref of args.references) {
          ensureSpace(16)
          drawWrappedText(`[${ref.number}]  ${ref.citation}`, { x: MARGIN, size: 9, font: fontRegular, color: colors.body, lineHeight: 13, indent: 0 })
          y -= 4
        }
      }

      // Draw footer on last page
      drawFooter()

      const pdfBytes = await pdfDoc.save()
      await writeFile(filePath, pdfBytes)

      return { success: true, filePath }
    }
  )

  // Export all slides as PDF
  ipcMain.handle(
    IPC_CHANNELS.STUDIO_EXPORT_PDF,
    async (_event, args: { imagePaths: string[]; aspectRatio: '16:9' | '4:3'; defaultName: string }) => {
      const { PDFDocument } = await import('pdf-lib')

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: args.defaultName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })

      if (canceled || !filePath) {
        return { success: false }
      }

      const pdfDoc = await PDFDocument.create()

      // Page dimensions in points (72pt/inch)
      const isWide = args.aspectRatio === '16:9'
      const pageWidth = isWide ? 960 : 720
      const pageHeight = isWide ? 540 : 540

      for (const imgPath of args.imagePaths) {
        try {
          const imgBytes = await readFile(imgPath)

          // Detect actual image format from magic bytes
          const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50 && imgBytes[2] === 0x4e && imgBytes[3] === 0x47
          const isJpeg = imgBytes[0] === 0xff && imgBytes[1] === 0xd8

          let image
          if (isPng) {
            image = await pdfDoc.embedPng(imgBytes)
          } else if (isJpeg) {
            image = await pdfDoc.embedJpg(imgBytes)
          } else {
            // Try both — PNG first, then JPEG
            try {
              image = await pdfDoc.embedPng(imgBytes)
            } catch {
              image = await pdfDoc.embedJpg(imgBytes)
            }
          }

          const page = pdfDoc.addPage([pageWidth, pageHeight])
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
          })
        } catch (err) {
          console.error(`Failed to embed slide image: ${imgPath}`, err)
        }
      }

      const pdfBytes = await pdfDoc.save()
      await writeFile(filePath, pdfBytes)

      return { success: true, filePath }
    }
  )
}
