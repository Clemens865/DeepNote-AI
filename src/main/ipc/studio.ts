import { ipcMain, BrowserWindow, dialog } from 'electron'
import { copyFile } from 'fs/promises'
import { extname } from 'path'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { aiService } from '../services/ai'
import { ttsService } from '../services/tts'
import { imagenService, STYLE_PRESETS, buildSlidePrompt, buildHybridSlidePrompt } from '../services/imagen'

const TYPE_TITLES: Record<string, string> = {
  report: 'Report',
  quiz: 'Quiz',
  flashcard: 'Flashcards',
  mindmap: 'Mind Map',
  datatable: 'Data Table',
  slides: 'Slide Deck',
  'image-slides': 'Image Slide Deck',
  audio: 'Audio Overview',
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
        // Generate content via AI
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

      // Find style preset
      const stylePreset = STYLE_PRESETS.find((p) => p.id === args.stylePresetId)
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
          let styleDescription = stylePreset.promptSuffix
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
            args.userInstructions
          )

          // Phase B: Generate each slide image
          const slides: { slideNumber: number; title: string; bullets: string[]; imagePath: string; speakerNotes: string }[] = []
          const hybridSlides: { slideNumber: number; title: string; bullets: string[]; imagePath: string; speakerNotes: string; layout: string }[] = []

          for (const plan of contentPlan) {
            broadcastToWindows('image-slides:progress', {
              generatedContentId,
              stage: 'generating',
              currentSlide: plan.slideNumber,
              totalSlides: contentPlan.length,
              message: `Generating slide ${plan.slideNumber} of ${contentPlan.length}...`,
            })

            try {
              let prompt: string
              if (renderMode === 'hybrid') {
                prompt = buildHybridSlidePrompt(
                  styleDescription,
                  plan.visualCue,
                  plan.layout
                )
              } else {
                prompt = buildSlidePrompt(
                  plan.content,
                  styleDescription,
                  plan.layout,
                  plan.visualCue
                )
              }

              const imagePath = await imagenService.generateSlideImage(prompt, {
                aspectRatio: args.aspectRatio,
                contentId: generatedContentId,
                slideNumber: plan.slideNumber,
              })

              if (renderMode === 'hybrid') {
                hybridSlides.push({
                  slideNumber: plan.slideNumber,
                  title: plan.title,
                  bullets: plan.bullets,
                  imagePath,
                  speakerNotes: plan.speakerNotes,
                  layout: plan.layout,
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
}
