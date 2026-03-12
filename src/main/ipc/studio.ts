import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { copyFile, readFile, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { eq, desc } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { aiService } from '../services/ai'
import { ttsService } from '../services/tts'
import { imagenService, STYLE_PRESETS, buildSlidePrompt, buildHybridSlidePrompt } from '../services/imagen'
import { shouldUsePipeline } from '../services/generationPipeline'
import { knowledgeStoreService } from '../services/knowledgeStore'
import { configService } from '../services/config'
import { renderSlidesToHtml } from '../services/htmlRenderer'
import { renderSlidesToPptx } from '../services/pptxRenderer'
import { parsePptxTemplate } from '../services/pptxTemplateParser'
import type { StructuredSlide, PresentationTheme } from '../../shared/types'

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
  'html-presentation': 'HTML Presentation',
  video: 'Video Overview',
}

function hexToRgbTuple(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `${r},${g},${b}`
}

/** Build a slugified asset name: TopicName-AssetType-Date */
function buildAssetName(topicTitle: string, assetType: string): string {
  const slug = topicTitle
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
    .replace(/-+$/, '')
  const date = new Date().toISOString().split('T')[0]
  return `${slug}-${assetType}-${date}`
}

/** Build a Map of bodyContentId → base64 data URL for all slides with imagePath set */
async function resolveSlideImages(slides: StructuredSlide[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const slide of slides) {
    for (const item of slide.bodyContent) {
      if (item.type === 'image-placeholder' && item.imagePath) {
        try {
          const buf = await readFile(item.imagePath)
          map.set(item.id, `data:image/png;base64,${buf.toString('base64')}`)
        } catch {
          // Image file missing — skip
        }
      }
    }
  }
  return map
}

// HTML Presentation style presets
const HTML_PRESENTATION_PRESETS = [
  {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    description: 'Deep dark + indigo/purple',
    colorPalette: ['#050510', '#6366f1', '#a855f7', '#ec4899', '#818cf8'],
    cssVariables: {
      '--bg-primary': '#050510',
      '--bg-secondary': '#0a0a1a',
      '--accent-1': '#6366f1',
      '--accent-2': '#a855f7',
      '--accent-3': '#ec4899',
      '--text-primary': 'rgba(255,255,255,0.95)',
      '--text-secondary': 'rgba(255,255,255,0.85)',
      '--text-muted': 'rgba(255,255,255,0.5)',
      '--glass-bg': 'rgba(255,255,255,0.03)',
      '--glass-border': 'rgba(255,255,255,0.06)',
      '--particle-rgb': '99,102,241',
    },
    promptSuffix: 'deep dark background with indigo, purple, and pink accents — modern, futuristic, elegant',
  },
  {
    id: 'sunset-gradient',
    name: 'Sunset Gradient',
    description: 'Warm oranges/reds/amber',
    colorPalette: ['#0f0a05', '#f97316', '#ef4444', '#f59e0b', '#fbbf24'],
    cssVariables: {
      '--bg-primary': '#0f0a05',
      '--bg-secondary': '#1a0f08',
      '--accent-1': '#f97316',
      '--accent-2': '#ef4444',
      '--accent-3': '#f59e0b',
      '--text-primary': 'rgba(255,248,240,0.95)',
      '--text-secondary': 'rgba(255,248,240,0.85)',
      '--text-muted': 'rgba(255,248,240,0.5)',
      '--glass-bg': 'rgba(255,200,150,0.03)',
      '--glass-border': 'rgba(255,200,150,0.08)',
      '--particle-rgb': '249,115,22',
    },
    promptSuffix: 'warm sunset tones with oranges, reds, and amber on a dark warm background — energetic and inviting',
  },
  {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    description: 'Deep blues/teals',
    colorPalette: ['#020817', '#0ea5e9', '#06b6d4', '#2563eb', '#38bdf8'],
    cssVariables: {
      '--bg-primary': '#020817',
      '--bg-secondary': '#0a1628',
      '--accent-1': '#0ea5e9',
      '--accent-2': '#06b6d4',
      '--accent-3': '#2563eb',
      '--text-primary': 'rgba(240,250,255,0.95)',
      '--text-secondary': 'rgba(240,250,255,0.85)',
      '--text-muted': 'rgba(240,250,255,0.5)',
      '--glass-bg': 'rgba(14,165,233,0.04)',
      '--glass-border': 'rgba(14,165,233,0.08)',
      '--particle-rgb': '14,165,233',
    },
    promptSuffix: 'deep ocean blues and teals on a dark navy background — calm, professional, trustworthy',
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    description: 'Bright cyan/magenta, cyberpunk',
    colorPalette: ['#0a0a0a', '#22d3ee', '#d946ef', '#06b6d4', '#e879f9'],
    cssVariables: {
      '--bg-primary': '#0a0a0a',
      '--bg-secondary': '#111111',
      '--accent-1': '#22d3ee',
      '--accent-2': '#d946ef',
      '--accent-3': '#06b6d4',
      '--text-primary': 'rgba(255,255,255,0.95)',
      '--text-secondary': 'rgba(255,255,255,0.85)',
      '--text-muted': 'rgba(255,255,255,0.5)',
      '--glass-bg': 'rgba(34,211,238,0.03)',
      '--glass-border': 'rgba(34,211,238,0.08)',
      '--particle-rgb': '34,211,238',
    },
    promptSuffix: 'neon cyberpunk aesthetic with bright cyan and magenta on pure dark — electric, bold, futuristic',
  },
  {
    id: 'forest-canopy',
    name: 'Forest Canopy',
    description: 'Deep greens/earth tones',
    colorPalette: ['#050f0a', '#22c55e', '#16a34a', '#84cc16', '#4ade80'],
    cssVariables: {
      '--bg-primary': '#050f0a',
      '--bg-secondary': '#0a1a10',
      '--accent-1': '#22c55e',
      '--accent-2': '#16a34a',
      '--accent-3': '#84cc16',
      '--text-primary': 'rgba(240,255,244,0.95)',
      '--text-secondary': 'rgba(240,255,244,0.85)',
      '--text-muted': 'rgba(240,255,244,0.5)',
      '--glass-bg': 'rgba(34,197,94,0.03)',
      '--glass-border': 'rgba(34,197,94,0.08)',
      '--particle-rgb': '34,197,94',
    },
    promptSuffix: 'deep forest greens and earth tones on a dark background — natural, organic, grounded',
  },
  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    description: 'Icy blues/whites on dark slate',
    colorPalette: ['#0f1729', '#38bdf8', '#e2e8f0', '#7dd3fc', '#94a3b8'],
    cssVariables: {
      '--bg-primary': '#0f1729',
      '--bg-secondary': '#162033',
      '--accent-1': '#38bdf8',
      '--accent-2': '#7dd3fc',
      '--accent-3': '#e2e8f0',
      '--text-primary': 'rgba(248,250,252,0.95)',
      '--text-secondary': 'rgba(248,250,252,0.85)',
      '--text-muted': 'rgba(248,250,252,0.5)',
      '--glass-bg': 'rgba(56,189,248,0.04)',
      '--glass-border': 'rgba(56,189,248,0.08)',
      '--particle-rgb': '56,189,248',
    },
    promptSuffix: 'icy arctic blues and whites on dark slate — clean, crisp, minimalist, crystalline',
  },
  {
    id: 'corporate-clean',
    name: 'Corporate Clean',
    description: 'Professional navy/slate/blue',
    colorPalette: ['#0f172a', '#3b82f6', '#64748b', '#1e40af', '#f1f5f9'],
    cssVariables: {
      '--bg-primary': '#0f172a',
      '--bg-secondary': '#1e293b',
      '--accent-1': '#3b82f6',
      '--accent-2': '#1e40af',
      '--accent-3': '#64748b',
      '--text-primary': 'rgba(241,245,249,0.95)',
      '--text-secondary': 'rgba(241,245,249,0.85)',
      '--text-muted': 'rgba(241,245,249,0.5)',
      '--glass-bg': 'rgba(59,130,246,0.04)',
      '--glass-border': 'rgba(59,130,246,0.08)',
      '--particle-rgb': '59,130,246',
    },
    promptSuffix: 'corporate professional with navy and blue on dark slate — trustworthy, clean, enterprise',
  },
  {
    id: 'startup-fresh',
    name: 'Startup Fresh',
    description: 'Vibrant lime/teal/yellow',
    colorPalette: ['#0a0f0a', '#84cc16', '#14b8a6', '#facc15', '#a3e635'],
    cssVariables: {
      '--bg-primary': '#0a0f0a',
      '--bg-secondary': '#111a11',
      '--accent-1': '#84cc16',
      '--accent-2': '#14b8a6',
      '--accent-3': '#facc15',
      '--text-primary': 'rgba(245,255,240,0.95)',
      '--text-secondary': 'rgba(245,255,240,0.85)',
      '--text-muted': 'rgba(245,255,240,0.5)',
      '--glass-bg': 'rgba(132,204,22,0.04)',
      '--glass-border': 'rgba(132,204,22,0.08)',
      '--particle-rgb': '132,204,22',
    },
    promptSuffix: 'vibrant startup energy with lime green, teal, and yellow on dark — fresh, innovative, dynamic',
  },
  {
    id: 'academic-classic',
    name: 'Academic Classic',
    description: 'Warm ivory/burgundy/gold',
    colorPalette: ['#1a1410', '#b45309', '#991b1b', '#d97706', '#fef3c7'],
    cssVariables: {
      '--bg-primary': '#1a1410',
      '--bg-secondary': '#211a14',
      '--accent-1': '#d97706',
      '--accent-2': '#991b1b',
      '--accent-3': '#b45309',
      '--text-primary': 'rgba(254,243,199,0.95)',
      '--text-secondary': 'rgba(254,243,199,0.85)',
      '--text-muted': 'rgba(254,243,199,0.5)',
      '--glass-bg': 'rgba(217,119,6,0.04)',
      '--glass-border': 'rgba(217,119,6,0.08)',
      '--particle-rgb': '217,119,6',
    },
    promptSuffix: 'academic classic with warm gold, burgundy on dark brown — scholarly, authoritative, refined',
  },
  {
    id: 'tech-dark',
    name: 'Tech Dark',
    description: 'Matrix green/terminal black',
    colorPalette: ['#030712', '#10b981', '#059669', '#34d399', '#6ee7b7'],
    cssVariables: {
      '--bg-primary': '#030712',
      '--bg-secondary': '#0a1120',
      '--accent-1': '#10b981',
      '--accent-2': '#059669',
      '--accent-3': '#34d399',
      '--text-primary': 'rgba(209,250,229,0.95)',
      '--text-secondary': 'rgba(209,250,229,0.85)',
      '--text-muted': 'rgba(209,250,229,0.5)',
      '--glass-bg': 'rgba(16,185,129,0.04)',
      '--glass-border': 'rgba(16,185,129,0.08)',
      '--particle-rgb': '16,185,129',
    },
    promptSuffix: 'tech terminal aesthetic with emerald green on black — code, hacker, developer',
  },
  {
    id: 'warm-earth',
    name: 'Warm Earth',
    description: 'Terracotta/amber/sand',
    colorPalette: ['#1c1210', '#c2410c', '#ea580c', '#d97706', '#fde68a'],
    cssVariables: {
      '--bg-primary': '#1c1210',
      '--bg-secondary': '#231815',
      '--accent-1': '#ea580c',
      '--accent-2': '#c2410c',
      '--accent-3': '#d97706',
      '--text-primary': 'rgba(253,230,138,0.95)',
      '--text-secondary': 'rgba(253,230,138,0.85)',
      '--text-muted': 'rgba(253,230,138,0.5)',
      '--glass-bg': 'rgba(234,88,12,0.04)',
      '--glass-border': 'rgba(234,88,12,0.08)',
      '--particle-rgb': '234,88,12',
    },
    promptSuffix: 'warm earthy terracotta and amber on dark brown — organic, grounded, warm',
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    description: 'Soft pastels on deep slate',
    colorPalette: ['#0f0d1a', '#c084fc', '#f9a8d4', '#93c5fd', '#fde68a'],
    cssVariables: {
      '--bg-primary': '#0f0d1a',
      '--bg-secondary': '#1a1528',
      '--accent-1': '#c084fc',
      '--accent-2': '#f9a8d4',
      '--accent-3': '#93c5fd',
      '--text-primary': 'rgba(253,230,138,0.95)',
      '--text-secondary': 'rgba(250,245,255,0.85)',
      '--text-muted': 'rgba(250,245,255,0.5)',
      '--glass-bg': 'rgba(192,132,252,0.04)',
      '--glass-border': 'rgba(192,132,252,0.08)',
      '--particle-rgb': '192,132,252',
    },
    promptSuffix: 'soft dreamy pastels — lavender, pink, sky blue on deep slate — gentle, creative, whimsical',
  },
]

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

    // Get notebook title for naming
    const notebooks = await db
      .select()
      .from(schema.notebooks)
      .where(eq(schema.notebooks.id, args.notebookId))
    const notebookTitle = notebooks[0]?.title || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    // Create record with generating status
    const record = {
      id,
      notebookId: args.notebookId,
      type: args.type as 'report' | 'quiz' | 'flashcard',
      title: buildAssetName(notebookTitle, TYPE_TITLES[args.type]?.replace(/\s+/g, '') || args.type),
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

      // Store asset name in data for viewer export access
      generatedData.assetName = record.title

      // Update record with generated data
      await db
        .update(schema.generatedContent)
        .set({
          data: JSON.stringify(generatedData),
          status: 'completed',
        })
        .where(eq(schema.generatedContent.id, id))

      // Fire-and-forget: store generation event in knowledge store (if enabled)
      if (configService.getAll().knowledgeEnabled !== false) {
        knowledgeStoreService.add(
          `[DeepNote Studio] Generated ${args.type}: "${record.title}" in notebook ${args.notebookId} from ${sourceIds.length} sources`,
          { type: 'chat', importance: 0.5 }
        ).catch((err) => console.warn('[Studio] Knowledge store failed:', err))
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
      .orderBy(desc(schema.generatedContent.createdAt))
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

  // Save HTML file — show save dialog and write HTML string
  ipcMain.handle(
    IPC_CHANNELS.STUDIO_SAVE_HTML,
    async (_event, args: { html: string; defaultName: string }) => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: args.defaultName,
        filters: [{ name: 'HTML', extensions: ['html'] }],
      })

      if (canceled || !filePath) {
        return { success: false }
      }

      await writeFile(filePath, args.html, 'utf-8')
      return { success: true, filePath }
    }
  )

  // Open HTML in browser via temp file
  ipcMain.handle(
    IPC_CHANNELS.STUDIO_OPEN_HTML_TEMP,
    async (_event, args: { html: string; filename: string }) => {
      const tempPath = join(tmpdir(), args.filename)
      await writeFile(tempPath, args.html, 'utf-8')
      await shell.openPath(tempPath)
      return { success: true }
    }
  )

  // HTML Presentation — fire-and-forget, two-phase generation
  ipcMain.handle(
    IPC_CHANNELS.HTML_PRESENTATION_START,
    async (_event, args: {
      notebookId: string
      model: 'flash' | 'pro'
      stylePresetId: string
      outputMode?: 'html' | 'pptx'
      pptxTemplatePath?: string
      userInstructions?: string
      customStyleImagePath?: string
      customStyleColors?: string[]
      customStyleDescription?: string
      styleInfluence?: import('../../shared/types').StyleInfluence
    }) => {
      const db = getDatabase()
      const now = new Date().toISOString()
      const generatedContentId = randomUUID()
      const outputMode = args.outputMode || 'html'

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

      // Resolve style preset → PresentationTheme
      let theme: PresentationTheme
      let styleInstructions = ''

      if (args.pptxTemplatePath) {
        theme = await parsePptxTemplate(args.pptxTemplatePath)
      } else if (args.stylePresetId === 'custom-builder' && args.customStyleColors && args.customStyleDescription) {
        const [bg, primary, accent, text] = args.customStyleColors
        theme = {
          name: 'Custom',
          colors: {
            background: bg,
            backgroundSecondary: bg,
            accent1: primary,
            accent2: accent,
            accent3: accent,
            textPrimary: text,
            textSecondary: text,
            textMuted: `color-mix(in srgb, ${text} 50%, transparent)`,
          },
          fonts: { heading: 'Inter', body: 'Inter' },
          cssVariables: {
            '--bg-primary': bg,
            '--bg-secondary': bg,
            '--accent-1': primary,
            '--accent-2': accent,
            '--accent-3': accent,
            '--text-primary': text,
            '--text-secondary': text,
            '--text-muted': `color-mix(in srgb, ${text} 50%, transparent)`,
            '--glass-bg': `color-mix(in srgb, ${primary} 4%, transparent)`,
            '--glass-border': `color-mix(in srgb, ${primary} 8%, transparent)`,
            '--particle-rgb': hexToRgbTuple(primary),
          },
        }
        styleInstructions = args.customStyleDescription
      } else {
        const preset = HTML_PRESENTATION_PRESETS.find((p) => p.id === args.stylePresetId) || HTML_PRESENTATION_PRESETS[0]
        theme = {
          name: preset.name,
          colors: {
            background: preset.colorPalette[0],
            backgroundSecondary: preset.cssVariables['--bg-secondary'],
            accent1: preset.cssVariables['--accent-1'],
            accent2: preset.cssVariables['--accent-2'],
            accent3: preset.cssVariables['--accent-3'],
            textPrimary: preset.cssVariables['--text-primary'],
            textSecondary: preset.cssVariables['--text-secondary'],
            textMuted: preset.cssVariables['--text-muted'],
          },
          fonts: { heading: 'Inter', body: 'Inter' },
          cssVariables: preset.cssVariables,
        }
        styleInstructions = preset.promptSuffix
      }

      await db.insert(schema.generatedContent).values({
        id: generatedContentId,
        notebookId: args.notebookId,
        type: 'html-presentation' as const,
        title: `${outputMode === 'pptx' ? 'PowerPoint' : 'Web'} Presentation - ${new Date().toLocaleDateString()}`,
        data: {} as unknown as string,
        sourceIds: JSON.stringify(sourceIds),
        status: 'generating' as const,
        createdAt: now,
      })

      ;(async () => {
        try {
          if (args.customStyleImagePath) {
            broadcastToWindows('html-presentation:progress', {
              generatedContentId,
              stage: 'analyzing-style',
              message: 'Analyzing reference image style...',
            })
            styleInstructions = await aiService.describeImageStyle(args.customStyleImagePath)
          }

          broadcastToWindows('html-presentation:progress', {
            generatedContentId,
            stage: 'planning',
            message: 'Planning slide content and layouts...',
          })

          const slides = await aiService.planPresentationSlides(sourceTexts, {
            theme,
            userInstructions: args.userInstructions
              ? `${args.userInstructions}${styleInstructions ? `. Style: ${styleInstructions}` : ''}`
              : styleInstructions || undefined,
            model: args.model,
          })

          broadcastToWindows('html-presentation:progress', {
            generatedContentId,
            stage: 'rendering',
            message: `Rendering ${outputMode === 'pptx' ? 'PowerPoint' : 'HTML'} presentation...`,
          })

          const data: Record<string, unknown> = { slides, theme, outputMode }

          if (outputMode === 'pptx') {
            const pptxBuffer = await renderSlidesToPptx(slides, theme)
            const pptxPath = join(tmpdir(), `presentation-${generatedContentId}.pptx`)
            await writeFile(pptxPath, pptxBuffer)
            data.pptxPath = pptxPath
          } else {
            data.html = renderSlidesToHtml(slides, theme)
          }

          // Update title with AI-generated name from first slide
          const presentationTitle = (slides[0]?.title || 'Presentation').replace(/^Title:\s*/i, '')
          const typeLabel = outputMode === 'pptx' ? 'PowerPoint' : 'Presentation'
          const presentationAssetName = buildAssetName(presentationTitle, typeLabel)
          data.assetName = presentationAssetName

          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              title: presentationAssetName,
              data: data as unknown as string,
              status: 'completed',
            })
            .where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('html-presentation:complete', {
            generatedContentId,
            success: true,
          })
        } catch (err) {
          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              data: {
                error: err instanceof Error ? err.message : 'Presentation generation failed',
              } as unknown as string,
              status: 'failed',
            })
            .where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('html-presentation:complete', {
            generatedContentId,
            success: false,
            error: err instanceof Error ? err.message : 'Presentation generation failed',
          })
        }
      })()

      return { generatedContentId }
    }
  )

  // Update a single slide's content (no AI call, instant re-render)
  ipcMain.handle(
    IPC_CHANNELS.HTML_PRESENTATION_UPDATE_SLIDE,
    async (_event, args: { generatedContentId: string; slide: StructuredSlide }) => {
      const db = getDatabase()
      const records = await db
        .select()
        .from(schema.generatedContent)
        .where(eq(schema.generatedContent.id, args.generatedContentId))
      const record = records[0]
      if (!record) throw new Error('Content not found')

      const data = (typeof record.data === 'string' ? JSON.parse(record.data) : record.data) as Record<string, unknown>
      const slides = (data.slides || []) as StructuredSlide[]
      const theme = data.theme as PresentationTheme
      const idx = slides.findIndex(s => s.id === args.slide.id)
      if (idx !== -1) slides[idx] = args.slide
      data.slides = slides
      const imageDataMap = await resolveSlideImages(slides)
      const html = renderSlidesToHtml(slides, theme, imageDataMap)
      data.html = html

      await db.update(schema.generatedContent)
        .set({ data: data as unknown as string })
        .where(eq(schema.generatedContent.id, args.generatedContentId))

      return { html }
    }
  )

  // Regenerate a single slide with AI
  ipcMain.handle(
    IPC_CHANNELS.HTML_PRESENTATION_REGEN_SLIDE,
    async (_event, args: { generatedContentId: string; slideId: string; instruction?: string }) => {
      const db = getDatabase()
      const records = await db
        .select()
        .from(schema.generatedContent)
        .where(eq(schema.generatedContent.id, args.generatedContentId))
      const record = records[0]
      if (!record) throw new Error('Content not found')

      const data = (typeof record.data === 'string' ? JSON.parse(record.data) : record.data) as Record<string, unknown>
      const slides = (data.slides || []) as StructuredSlide[]
      const theme = data.theme as PresentationTheme
      const idx = slides.findIndex(s => s.id === args.slideId)
      if (idx === -1) throw new Error('Slide not found')

      const sourceIdsRaw = typeof record.sourceIds === 'string' ? JSON.parse(record.sourceIds) : record.sourceIds
      const sources = await db.select().from(schema.sources).where(eq(schema.sources.notebookId, record.notebookId))
      const sourceExcerpt = sources
        .filter(s => (sourceIdsRaw as string[]).includes(s.id))
        .map(s => s.content).join('\n\n---\n\n').slice(0, 20000)

      const newSlide = await aiService.regenerateSingleSlide(
        slides[idx],
        {
          prevSlideTitle: idx > 0 ? slides[idx - 1].title : undefined,
          nextSlideTitle: idx < slides.length - 1 ? slides[idx + 1].title : undefined,
          sourceExcerpt,
        },
        args.instruction
      )

      slides[idx] = newSlide
      data.slides = slides
      const imageDataMap = await resolveSlideImages(slides)
      const html = renderSlidesToHtml(slides, theme, imageDataMap)
      data.html = html

      await db.update(schema.generatedContent)
        .set({ data: data as unknown as string })
        .where(eq(schema.generatedContent.id, args.generatedContentId))

      return { slide: newSlide, html }
    }
  )

  // Reorder slides
  ipcMain.handle(
    IPC_CHANNELS.HTML_PRESENTATION_REORDER_SLIDES,
    async (_event, args: { generatedContentId: string; slideIds: string[] }) => {
      const db = getDatabase()
      const records = await db
        .select()
        .from(schema.generatedContent)
        .where(eq(schema.generatedContent.id, args.generatedContentId))
      const record = records[0]
      if (!record) throw new Error('Content not found')

      const data = (typeof record.data === 'string' ? JSON.parse(record.data) : record.data) as Record<string, unknown>
      const slides = (data.slides || []) as StructuredSlide[]
      const theme = data.theme as PresentationTheme

      const slideMap = new Map(slides.map(s => [s.id, s]))
      const reordered = args.slideIds
        .map(id => slideMap.get(id))
        .filter((s): s is StructuredSlide => !!s)
        .map((s, i) => ({ ...s, slideNumber: i + 1 }))

      data.slides = reordered
      const imageDataMap = await resolveSlideImages(reordered)
      data.html = renderSlidesToHtml(reordered, theme, imageDataMap)

      await db.update(schema.generatedContent)
        .set({ data: data as unknown as string })
        .where(eq(schema.generatedContent.id, args.generatedContentId))
    }
  )

  // Generate image for a slide body content item
  ipcMain.handle(
    IPC_CHANNELS.HTML_PRESENTATION_GENERATE_IMAGE,
    async (_event, args: { generatedContentId: string; slideId: string; bodyContentId: string; prompt: string; imageModel?: import('../../shared/types').ImageModelId }) => {
      const db = getDatabase()
      const records = await db
        .select()
        .from(schema.generatedContent)
        .where(eq(schema.generatedContent.id, args.generatedContentId))
      const record = records[0]
      if (!record) throw new Error('Content not found')

      const data = (typeof record.data === 'string' ? JSON.parse(record.data) : record.data) as Record<string, unknown>
      const slides = (data.slides || []) as StructuredSlide[]
      const theme = data.theme as PresentationTheme

      const slideIdx = slides.findIndex(s => s.id === args.slideId)
      if (slideIdx === -1) throw new Error('Slide not found')

      const slide = slides[slideIdx]
      const bcIdx = slide.bodyContent.findIndex(bc => bc.id === args.bodyContentId)
      if (bcIdx === -1) throw new Error('Body content item not found')

      // Generate the image
      const imagePath = await imagenService.generateSlideImage(args.prompt, {
        aspectRatio: '16:9',
        contentId: args.generatedContentId,
        slideNumber: slide.slideNumber,
        imageModel: args.imageModel,
      })

      // Update slide data
      slide.bodyContent[bcIdx].imagePath = imagePath
      slide.bodyContent[bcIdx].imagePrompt = args.prompt
      slides[slideIdx] = slide
      data.slides = slides

      // Re-render HTML with images
      const imageDataMap = await resolveSlideImages(slides)
      const html = renderSlidesToHtml(slides, theme, imageDataMap)
      data.html = html

      await db.update(schema.generatedContent)
        .set({ data: data as unknown as string })
        .where(eq(schema.generatedContent.id, args.generatedContentId))

      return { slide, html }
    }
  )

  // Export to PPTX from any presentation (even HTML-mode ones)
  ipcMain.handle(
    IPC_CHANNELS.HTML_PRESENTATION_EXPORT_PPTX,
    async (_event, args: { generatedContentId: string }) => {
      const db = getDatabase()
      const records = await db
        .select()
        .from(schema.generatedContent)
        .where(eq(schema.generatedContent.id, args.generatedContentId))
      const record = records[0]
      if (!record) throw new Error('Content not found')

      const data = (typeof record.data === 'string' ? JSON.parse(record.data) : record.data) as Record<string, unknown>
      const slides = (data.slides || []) as StructuredSlide[]
      const theme = data.theme as PresentationTheme

      if (!slides.length) throw new Error('No structured slides found. This presentation was generated with an older version.')

      const pptxBuffer = await renderSlidesToPptx(slides, theme)
      const pptxPath = join(tmpdir(), `presentation-${args.generatedContentId}.pptx`)
      await writeFile(pptxPath, pptxBuffer)

      const safeName = (record.title || 'Presentation').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
      const result = await dialog.showSaveDialog({
        defaultPath: `${safeName}.pptx`,
        filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
      })

      if (result.canceled || !result.filePath) return { success: false }
      await copyFile(pptxPath, result.filePath)
      return { success: true, filePath: result.filePath }
    }
  )

  // Parse PPTX template
  ipcMain.handle(
    IPC_CHANNELS.HTML_PRESENTATION_PARSE_TEMPLATE,
    async (_event, args: { filePath: string }) => {
      return parsePptxTemplate(args.filePath)
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
      format?: 'infographic' | 'advertisement' | 'social-post'
      stylePresetId: string
      aspectRatio: '16:9' | '4:3' | '1:1' | '9:16' | '3:4'
      renderMode?: 'full-image' | 'hybrid'
      userInstructions?: string
      customStyleImagePath?: string
      customStyleColors?: string[]
      customStyleDescription?: string
      imageModel?: import('../../shared/types').ImageModelId
      styleInfluence?: import('../../shared/types').StyleInfluence
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

          const plan = await aiService.planInfographic(sourceTexts, args.format)

          // Update title with AI-generated name
          const formatLabel = args.format === 'advertisement' ? 'Ad' : args.format === 'social-post' ? 'SocialPost' : 'Infographic'
          const assetName = buildAssetName(plan.title, formatLabel)
          await db.update(schema.generatedContent).set({ title: assetName }).where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('infographic:progress', {
            generatedContentId,
            stage: 'generating',
            message: 'Generating infographic image...',
          })

          // Support both new (sections) and legacy (keyPoints) plan shapes
          const sections = (plan as Record<string, unknown>).sections as { heading: string; annotation: string; stat?: { value: string; label: string } | null; visualDescription: string }[] | undefined
          const keyPoints = (plan as Record<string, unknown>).keyPoints as { heading: string; body: string; visualDescription: string }[] | undefined
          const planSections = sections || keyPoints || []
          const heroStat = (plan as Record<string, unknown>).heroStat as { value: string; label: string; context: string } | null | undefined
          const visualNarrative = (plan as Record<string, unknown>).visualNarrative as string | undefined

          const visualElements = planSections
            .map((s) => s.visualDescription)
            .join(', ')

          const userInstr = args.userInstructions ? `\nUser instructions: ${args.userInstructions}` : ''
          const renderMode = args.renderMode || 'full-image'
          const infographicFormat = args.format || 'infographic'
          const fillRule = `COMPOSITION: The image MUST fill the entire ${args.aspectRatio} frame edge-to-edge with NO empty space, NO borders, NO margins, NO letterboxing. Full-bleed artwork that extends to every edge.`

          // Format-specific design directives
          const formatDirectives: Record<string, string> = {
            'infographic': `FORMAT: Data Infographic — visual storytelling through icons, diagrams, charts, and data-viz elements. Think: conference poster or editorial dashboard. 80% visuals, 20% text. Use progress bars, pie charts, comparison arrows, metric badges, flow diagrams. Title at top in bold decorative font. Clean modern layout.`,
            'advertisement': `FORMAT: Advertisement / Marketing Asset — bold, attention-grabbing product or brand visual. Think: magazine ad, billboard, or product launch hero image. One dominant headline, a striking visual metaphor, and a clear call-to-action. Typography is large, confident, and integrated into the scene. Use lifestyle imagery, product visualization, or aspirational scenes. Keep text to: headline + tagline + CTA only.`,
            'social-post': `FORMAT: Social Media Post — optimized for sharing on Instagram, LinkedIn, or Twitter. One powerful hero visual with a single bold statement or quote. Minimal text — let the image do the talking. Text should be large, centered, and instantly readable. Think: viral shareable graphic. High visual impact, strong contrast, eye-catching composition.`,
          }
          const formatDirective = formatDirectives[infographicFormat] || formatDirectives['infographic']

          let imagePrompt: string
          let slideTextContent: string | undefined

          if (renderMode === 'full-image') {
            const sectionLabels = planSections.map((s) => {
              const stat = 'stat' in s && s.stat ? ` → ${s.stat.value} ${s.stat.label}` : ''
              const annotation = 'annotation' in s ? (s as { annotation: string }).annotation : ''
              return `• ${s.heading}${stat}${annotation ? ` — ${annotation}` : ''}`
            }).join('\n')

            const heroLine = heroStat ? `\nHERO NUMBER: ${heroStat.value} ${heroStat.label} (${heroStat.context})` : ''

            const textContent = [
              `TITLE: ${plan.title}`,
              plan.subtitle ? `TAGLINE: ${plan.subtitle}` : '',
              heroLine,
              '',
              sectionLabels,
            ].filter(Boolean).join('\n')

            slideTextContent = textContent

            imagePrompt = `Generate a single cinematic image about "${plan.title}" where text and visuals form one unified composition.
${visualNarrative ? `\nSCENE AND COMPOSITION: ${visualNarrative}` : ''}

${formatDirective}

${fillRule}

VISUAL STYLE: ${styleDescription}

INTEGRATED TEXT — render the following text as part of the image composition. The text should feel like it belongs in the scene — as stylized display typography, integrated into the environment, or as bold graphic design elements. NOT a floating overlay — part of the art:
${textContent}

Visual scene elements: ${visualElements}

DESIGN RULES:
- ${heroStat ? `Render "${heroStat.value}" as the LARGEST, most prominent text element integrated into the visual` : 'Use large icons and visual metaphors as focal points'}
- All text is part of the visual composition — integrated into surfaces, environments, or as stylized display typography
- No paragraphs or long sentences — only short labels, numbers, and keywords${userInstr}`
          } else {
            // Hybrid mode: atmospheric background, text overlaid as HTML
            imagePrompt = `Generate a rich, atmospheric, cinematic background image for "${plan.title}".
${visualNarrative ? `\nVISUAL STORY: ${visualNarrative}` : ''}

${formatDirective}

${fillRule}

The image should tell the story through visual metaphors, mood, and scene — NOT through text.

Visual scene elements to incorporate: ${visualElements}

Visual style: ${styleDescription}

CRITICAL RULES:
- Do NOT include ANY text, words, letters, numbers, or typography in the image
- This is a pure visual background — structured annotations will float on top as HTML
- Make it rich, immersive, and visually striking with depth, lighting, and atmosphere${userInstr}`
          }

          const imagePath = await imagenService.generateSlideImage(imagePrompt, {
            aspectRatio: args.aspectRatio,
            contentId: generatedContentId,
            slideNumber: 1,
            referenceImagePath: args.customStyleImagePath,
            shortSubject: renderMode === 'full-image'
              ? `professional infographic about ${plan.title}`
              : `atmospheric background about ${plan.title}: ${visualElements.slice(0, 200)}`,
            styleHint: args.customStyleImagePath ? styleDescription : undefined,
            slideTextContent: renderMode === 'full-image' ? slideTextContent : undefined,
            imageModel: args.imageModel,
            styleInfluence: args.styleInfluence,
          })

          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              data: { imagePath, plan, style: args.stylePresetId, aspectRatio: args.aspectRatio, renderMode, assetName } as unknown as string,
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

  // Infographic Animate — fire-and-forget pattern
  ipcMain.handle(
    IPC_CHANNELS.INFOGRAPHIC_ANIMATE,
    async (_event, args: { generatedContentId: string; animationPrompt?: string }) => {
      const { generateAnimationPrompt, animateImage } = await import('../services/veo')
      const db = getDatabase()

      const [content] = await db
        .select()
        .from(schema.generatedContent)
        .where(eq(schema.generatedContent.id, args.generatedContentId))

      if (!content) throw new Error('Generated content not found')

      const data = content.data as unknown as Record<string, unknown>
      const imagePath = data.imagePath as string | undefined
      if (!imagePath) throw new Error('No infographic image found to animate')

      ;(async () => {
        try {
          let prompt = args.animationPrompt
          if (!prompt) {
            broadcastToWindows('infographic:animate-progress', {
              generatedContentId: args.generatedContentId,
              stage: 'prompt',
              message: 'Generating animation prompt...',
            })
            prompt = await generateAnimationPrompt(imagePath)
          }

          broadcastToWindows('infographic:animate-progress', {
            generatedContentId: args.generatedContentId,
            stage: 'generating',
            message: 'Generating video with Veo 3.1...',
          })

          const { app } = await import('electron')
          const { join } = await import('path')
          const { mkdirSync, existsSync } = await import('fs')
          const cacheDir = join(app.getPath('userData'), 'slides-cache', args.generatedContentId)
          if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })
          const videoOutputPath = join(cacheDir, 'animation.mp4')

          await animateImage(imagePath, prompt, videoOutputPath, (message) => {
            broadcastToWindows('infographic:animate-progress', {
              generatedContentId: args.generatedContentId,
              stage: 'generating',
              message,
            })
          })

          // Update generatedContent data with videoPath
          const currentDb = getDatabase()
          const [current] = await currentDb
            .select()
            .from(schema.generatedContent)
            .where(eq(schema.generatedContent.id, args.generatedContentId))

          const currentData = (current?.data as unknown as Record<string, unknown>) || {}
          await currentDb
            .update(schema.generatedContent)
            .set({
              data: { ...currentData, videoPath: videoOutputPath } as unknown as string,
            })
            .where(eq(schema.generatedContent.id, args.generatedContentId))

          broadcastToWindows('infographic:animate-complete', {
            generatedContentId: args.generatedContentId,
            success: true,
            videoPath: videoOutputPath,
          })
        } catch (err) {
          broadcastToWindows('infographic:animate-complete', {
            generatedContentId: args.generatedContentId,
            success: false,
            error: err instanceof Error ? err.message : 'Animation generation failed',
          })
        }
      })()

      return { generatedContentId: args.generatedContentId }
    }
  )

  // Video Overview — Phase 1: Plan + generate images → storyboard
  ipcMain.handle(
    IPC_CHANNELS.VIDEO_OVERVIEW_START,
    async (_event, args: {
      notebookId: string
      mode: 'overview' | 'music-video'
      targetDurationSec: number
      narrativeStyle?: 'explain' | 'present' | 'storytell' | 'documentary'
      narrationEnabled?: boolean
      moodMode: 'auto' | 'custom' | 'reference'
      moodPrompt?: string
      referenceImagePath?: string
      styleInfluence?: import('../../shared/types').StyleInfluence
      stylePresetId: string
      customStyleColors?: string[]
      customStyleDescription?: string
      imageModel?: import('../../shared/types').ImageModelId
      veoModel?: string
      veoResolution?: string
      audioFilePath?: string
      lyricsText?: string
      userInstructions?: string
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

      await db.insert(schema.generatedContent).values({
        id: generatedContentId,
        notebookId: args.notebookId,
        type: 'video' as const,
        title: `Video Overview - ${new Date().toLocaleDateString()}`,
        data: {} as unknown as string,
        sourceIds: JSON.stringify(sourceIds),
        status: 'generating' as const,
        createdAt: now,
      })

      ;(async () => {
        try {
          const { generateStoryboard } = await import('../services/videoOverview')

          const storyboard = await generateStoryboard(
            { ...args, sourceTexts, narrativeStyle: args.narrativeStyle || 'explain' },
            (progress) => {
              broadcastToWindows('video-overview:progress', {
                generatedContentId,
                stage: progress.stage,
                message: progress.message,
                currentScene: progress.currentScene,
                totalScenes: progress.totalScenes,
              })
            }
          )

          // Save storyboard data for review — status stays 'generating' until animation
          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              title: storyboard.assetName,
              data: {
                mode: args.mode,
                storyboard: storyboard,
                narrationEnabled: args.narrationEnabled,
                narrativeStyle: args.narrativeStyle,
                audioFilePath: args.audioFilePath,
                veoModel: args.veoModel,
                veoResolution: args.veoResolution,
                assetName: storyboard.assetName,
              } as unknown as string,
              // Keep status 'generating' — storyboard is ready but video not yet
            })
            .where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('video-overview:storyboard-ready', {
            generatedContentId,
            scenes: storyboard.scenes,
            assetName: storyboard.assetName,
          })
        } catch (err) {
          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              data: { error: err instanceof Error ? err.message : 'Video storyboard generation failed' } as unknown as string,
              status: 'failed',
            })
            .where(eq(schema.generatedContent.id, generatedContentId))

          broadcastToWindows('video-overview:complete', {
            generatedContentId,
            success: false,
            error: err instanceof Error ? err.message : 'Video storyboard generation failed',
          })
        }
      })()

      return { generatedContentId }
    }
  )

  // Video Overview — Regenerate a single scene image
  ipcMain.handle(
    IPC_CHANNELS.VIDEO_OVERVIEW_REGEN_SCENE,
    async (_event, args: { generatedContentId: string; sceneNumber: number; instruction?: string }) => {
      const { regenerateSceneImage } = await import('../services/videoOverview')
      const db = getDatabase()

      const [content] = await db
        .select()
        .from(schema.generatedContent)
        .where(eq(schema.generatedContent.id, args.generatedContentId))

      if (!content) throw new Error('Generated content not found')
      const data = content.data as unknown as Record<string, unknown>
      const storyboard = data.storyboard as { scenes: { sceneNumber: number; imagePath: string; imagePrompt: string; animationPrompt: string; narrationText: string; durationSec: number }[]; styleDescription: string; moodDescription: string; contentDir: string; plan: unknown; assetName: string }
      if (!storyboard) throw new Error('No storyboard data found')

      const sceneIndex = storyboard.scenes.findIndex((s) => s.sceneNumber === args.sceneNumber)
      if (sceneIndex === -1) throw new Error(`Scene ${args.sceneNumber} not found`)

      const scene = storyboard.scenes[sceneIndex]
      const newImagePath = await regenerateSceneImage(
        scene,
        storyboard.styleDescription,
        args.instruction,
        {
          notebookId: content.notebookId,
          imageModel: undefined,
        }
      )

      // Update the storyboard in DB
      storyboard.scenes[sceneIndex] = { ...scene, imagePath: newImagePath }
      const currentDb = getDatabase()
      await currentDb
        .update(schema.generatedContent)
        .set({ data: { ...data, storyboard } as unknown as string })
        .where(eq(schema.generatedContent.id, args.generatedContentId))

      return { imagePath: newImagePath }
    }
  )

  // Video Overview — Phase 2: Animate storyboard → final video
  ipcMain.handle(
    IPC_CHANNELS.VIDEO_OVERVIEW_ANIMATE,
    async (_event, args: { generatedContentId: string }) => {
      const db = getDatabase()
      const [content] = await db
        .select()
        .from(schema.generatedContent)
        .where(eq(schema.generatedContent.id, args.generatedContentId))

      if (!content) throw new Error('Generated content not found')
      const data = content.data as unknown as Record<string, unknown>
      const storyboard = data.storyboard as import('../services/videoOverview').StoryboardResult
      if (!storyboard) throw new Error('No storyboard data found')

      ;(async () => {
        try {
          const { animateStoryboard } = await import('../services/videoOverview')

          const result = await animateStoryboard(
            storyboard,
            {
              mode: (data.mode as 'overview' | 'music-video') || 'overview',
              narrationEnabled: data.narrationEnabled as boolean | undefined,
              narrativeStyle: data.narrativeStyle as string | undefined,
              audioFilePath: data.audioFilePath as string | undefined,
              notebookId: content.notebookId,
              veoModel: data.veoModel as string | undefined,
              veoResolution: data.veoResolution as string | undefined,
            },
            (progress) => {
              broadcastToWindows('video-overview:progress', {
                generatedContentId: args.generatedContentId,
                stage: progress.stage,
                message: progress.message,
                currentScene: progress.currentScene,
                totalScenes: progress.totalScenes,
              })
            }
          )

          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              data: {
                videoPath: result.videoPath,
                mode: result.mode,
                totalDurationSec: result.totalDurationSec,
                narrativeStyle: result.narrativeStyle,
                moodDescription: result.moodDescription,
                scenes: result.scenes,
                assetName: result.assetName,
              } as unknown as string,
              status: 'completed',
            })
            .where(eq(schema.generatedContent.id, args.generatedContentId))

          broadcastToWindows('video-overview:complete', {
            generatedContentId: args.generatedContentId,
            success: true,
          })
        } catch (err) {
          const currentDb = getDatabase()
          await currentDb
            .update(schema.generatedContent)
            .set({
              data: { error: err instanceof Error ? err.message : 'Video animation failed' } as unknown as string,
              status: 'failed',
            })
            .where(eq(schema.generatedContent.id, args.generatedContentId))

          broadcastToWindows('video-overview:complete', {
            generatedContentId: args.generatedContentId,
            success: false,
            error: err instanceof Error ? err.message : 'Video animation failed',
          })
        }
      })()

      return { generatedContentId: args.generatedContentId }
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
      imageModel?: import('../../shared/types').ImageModelId
      styleInfluence?: import('../../shared/types').StyleInfluence
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
              imageModel: args.imageModel,
              styleInfluence: args.styleInfluence,
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
                imageModel: args.imageModel,
                styleInfluence: args.styleInfluence,
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
            assetName: buildAssetName(plan.title, 'WhitePaper'),
          }

          const wpAssetName = buildAssetName(plan.title, 'WhitePaper')
          await currentDb
            .update(schema.generatedContent)
            .set({
              title: wpAssetName,
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
      length?: 'test' | 'short' | 'default'
      slideCount?: number
      aspectRatio: '16:9' | '4:3' | '1:1' | '9:16' | '3:4'
      userInstructions?: string
      customStyleImagePath?: string
      renderMode?: 'full-image' | 'hybrid'
      customStyleColors?: string[]
      customStyleDescription?: string
      imageModel?: import('../../shared/types').ImageModelId
      promptTemplateId?: string
      promptOverride?: string
      styleInfluence?: import('../../shared/types').StyleInfluence
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

          // Determine slide count: explicit slideCount > length enum > default 10
          const slideCount = args.slideCount
            ? Math.max(1, Math.min(20, args.slideCount))
            : args.length === 'test' ? 3 : args.length === 'short' ? 5 : 10

          // Resolve user instructions: combine template + additional instructions into one directive
          let resolvedInstructions = ''
          // 1. Start with template text (or override)
          let templateText = ''
          if (args.promptOverride) {
            templateText = args.promptOverride
          } else if (args.promptTemplateId) {
            const db2 = getDatabase()
            const tplRows = await db2.select().from(schema.slidePromptTemplates).where(eq(schema.slidePromptTemplates.id, args.promptTemplateId))
            if (tplRows[0]) templateText = tplRows[0].promptText
          }
          // 2. Combine template + additional instructions
          const combinedText = [templateText, args.userInstructions].filter(Boolean).join('. ')
          if (combinedText) {
            try {
              const styleCtx = args.customStyleDescription || stylePreset?.colorPalette?.join(', ')
              resolvedInstructions = await aiService.optimizeSlidePrompt(combinedText, styleCtx)
            } catch {
              resolvedInstructions = combinedText
            }
          }

          const contentPlan = await aiService.planImageSlides(
            sourceTexts,
            slideCount,
            args.format,
            resolvedInstructions,
            renderMode
          )

          // Update title with AI-generated name from first slide
          const deckTitle = contentPlan[0]?.title || 'Slide Deck'
          const assetName = buildAssetName(deckTitle, 'Slides')
          await db.update(schema.generatedContent).set({ title: assetName }).where(eq(schema.generatedContent.id, generatedContentId))

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
                    isCustomStyle,
                    args.aspectRatio
                  )
                } else {
                  prompt = buildHybridSlidePrompt(
                    styleDescription,
                    plan.visualCue,
                    plan.layout,
                    false,
                    isCustomStyle,
                    args.aspectRatio
                  )
                }
              } else {
                prompt = buildSlidePrompt(
                  slideContent,
                  styleDescription,
                  plan.layout,
                  plan.visualCue,
                  isCustomStyle,
                  args.aspectRatio
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
                imageModel: args.imageModel,
                styleInfluence: args.styleInfluence,
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
              console.error(`Skipping slide ${plan.slideNumber}:`, slideErr instanceof Error ? slideErr.message : slideErr)
              if (slideErr && typeof slideErr === 'object') {
                if ('status' in slideErr) console.error('  API status:', (slideErr as { status: unknown }).status)
                if ('errorDetails' in slideErr) console.error('  API errorDetails:', JSON.stringify((slideErr as { errorDetails: unknown }).errorDetails))
                if ('message' in slideErr) console.error('  Full message:', (slideErr as { message: unknown }).message)
              }
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
            assetName,
            ...(args.stylePresetId === 'custom-builder' && args.customStyleColors
              ? { customPalette: args.customStyleColors }
              : {}),
            ...(args.customStyleImagePath ? { customStyleImagePath: args.customStyleImagePath } : {}),
            ...(args.customStyleDescription ? { customStyleDescription: args.customStyleDescription } : {}),
            ...(args.imageModel ? { imageModel: args.imageModel } : {}),
            ...(args.styleInfluence ? { styleInfluence: args.styleInfluence } : {}),
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

  // Image Slides — revise/regenerate a single slide
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_SLIDES_REGEN_SLIDE,
    async (_event, args: { generatedContentId: string; slideNumber: number; instruction?: string }) => {
      const db = getDatabase()
      const rows = await db
        .select()
        .from(schema.generatedContent)
        .where(eq(schema.generatedContent.id, args.generatedContentId))

      const record = rows[0]
      if (!record) throw new Error('Generated content not found')

      const data = (typeof record.data === 'string' ? JSON.parse(record.data) : record.data) as Record<string, unknown>
      const renderMode = (data.renderMode as string) || 'full-image'
      const isHybrid = renderMode === 'hybrid'
      const slidesArray = isHybrid
        ? (data.hybridSlides as { slideNumber: number; title: string; bullets: string[]; imagePath: string; speakerNotes: string; layout: string; elementLayout?: unknown[] }[])
        : (data.slides as { slideNumber: number; title: string; bullets: string[]; imagePath: string; speakerNotes: string }[])

      if (!slidesArray || slidesArray.length === 0) throw new Error('No slides data found')

      const slideIdx = slidesArray.findIndex((s) => s.slideNumber === args.slideNumber)
      if (slideIdx === -1) throw new Error(`Slide ${args.slideNumber} not found`)

      const currentSlide = slidesArray[slideIdx]
      const contentPlan = (data.contentPlan || []) as { slideNumber: number; title: string; bullets: string[]; content: string; visualCue: string; speakerNotes: string; layout: string }[]
      const planEntry = contentPlan.find((p) => p.slideNumber === args.slideNumber)

      // Get source context
      const sourceIdsRaw = typeof record.sourceIds === 'string' ? JSON.parse(record.sourceIds) : record.sourceIds
      const sources = await db.select().from(schema.sources).where(eq(schema.sources.notebookId, record.notebookId))
      const sourceExcerpt = sources
        .filter((s) => (sourceIdsRaw as string[]).includes(s.id))
        .map((s) => s.content).join('\n\n---\n\n').slice(0, 20000)

      // Neighbor context
      const prevSlideTitle = slideIdx > 0 ? slidesArray[slideIdx - 1].title : undefined
      const nextSlideTitle = slideIdx < slidesArray.length - 1 ? slidesArray[slideIdx + 1].title : undefined

      // Revise slide content via AI
      const currentPlan = planEntry || {
        title: currentSlide.title,
        bullets: currentSlide.bullets,
        content: currentSlide.title + '\n' + (currentSlide.bullets || []).join('\n'),
        visualCue: '',
        speakerNotes: currentSlide.speakerNotes || '',
        layout: (currentSlide as { layout?: string }).layout || 'Centered',
      }

      const revised = await aiService.reviseImageSlide(
        currentPlan,
        { prevSlideTitle, nextSlideTitle, sourceExcerpt, slideIndex: slideIdx, totalSlides: slidesArray.length },
        args.instruction,
        renderMode as 'full-image' | 'hybrid'
      )

      // Resolve style description for image generation
      const stylePresetId = data.style as string
      const aspectRatio = (data.aspectRatio as string) || '16:9'
      const customStyleImagePath = data.customStyleImagePath as string | undefined
      const customStyleDescription = data.customStyleDescription as string | undefined
      const customStyleColors = data.customPalette as string[] | undefined
      const imageModel = data.imageModel as import('../../shared/types').ImageModelId | undefined
      const styleInfluence = data.styleInfluence as import('../../shared/types').StyleInfluence | undefined
      const isCustomStyle = !!customStyleImagePath

      let styleDescription: string
      if (stylePresetId === 'custom-builder' && customStyleColors && customStyleDescription) {
        const [bg, primary, accent, text] = customStyleColors
        styleDescription = `with a ${bg} background, ${primary} as the primary accent color, ${accent} as the secondary accent color, ${text} for body text. ${customStyleDescription}. All slides share this exact same color scheme and visual style consistently`
      } else if (customStyleImagePath) {
        styleDescription = await aiService.describeImageStyle(customStyleImagePath)
      } else {
        const preset = STYLE_PRESETS.find((p) => p.id === stylePresetId)
        styleDescription = preset?.promptSuffix || ''
      }

      // Build image prompt
      const slideContent = (revised.content && revised.content.trim())
        ? revised.content
        : [revised.title, '', ...(revised.bullets || [])].join('\n')

      const isTitleSlide = args.slideNumber === 1
      const layout = currentPlan.layout || 'Centered'
      let prompt: string

      if (isHybrid) {
        if (isTitleSlide) {
          prompt = buildSlidePrompt(slideContent, styleDescription, layout, revised.visualCue, isCustomStyle, aspectRatio)
        } else {
          prompt = buildHybridSlidePrompt(styleDescription, revised.visualCue, layout, false, isCustomStyle, aspectRatio)
        }
      } else {
        prompt = buildSlidePrompt(slideContent, styleDescription, layout, revised.visualCue, isCustomStyle, aspectRatio)
      }

      // Generate new image (overwrites existing file at same path)
      const needsTextOnImage = !isHybrid || isTitleSlide
      const imagePath = await imagenService.generateSlideImage(prompt, {
        aspectRatio,
        contentId: args.generatedContentId,
        slideNumber: args.slideNumber,
        referenceImagePath: customStyleImagePath,
        shortSubject: revised.visualCue || revised.title,
        styleHint: isCustomStyle ? styleDescription : undefined,
        slideTextContent: needsTextOnImage ? slideContent : undefined,
        imageModel,
        styleInfluence,
      })

      // Update slide in data
      slidesArray[slideIdx] = {
        ...currentSlide,
        title: revised.title,
        bullets: revised.bullets,
        speakerNotes: revised.speakerNotes,
        imagePath,
      }
      if (isHybrid) {
        data.hybridSlides = slidesArray
      } else {
        data.slides = slidesArray
      }

      // Update content plan
      if (planEntry) {
        const planIdx = contentPlan.findIndex((p) => p.slideNumber === args.slideNumber)
        if (planIdx !== -1) {
          contentPlan[planIdx] = {
            ...contentPlan[planIdx],
            title: revised.title,
            bullets: revised.bullets,
            content: revised.content,
            visualCue: revised.visualCue,
            speakerNotes: revised.speakerNotes,
          }
          data.contentPlan = contentPlan
        }
      }

      // Save to DB
      await db
        .update(schema.generatedContent)
        .set({ data: data as unknown as string })
        .where(eq(schema.generatedContent.id, args.generatedContentId))

      return {
        imagePath,
        title: revised.title,
        bullets: revised.bullets,
        speakerNotes: revised.speakerNotes,
        visualCue: revised.visualCue,
      }
    }
  )

  // Image Slides — suggest slide count
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_SLIDES_SUGGEST_COUNT,
    async (_event, args: { notebookId: string; format: 'presentation' | 'pitch' | 'report' }) => {
      const db = getDatabase()
      const sources = await db
        .select()
        .from(schema.sources)
        .where(eq(schema.sources.notebookId, args.notebookId))

      const selectedSources = sources.filter((s) => s.isSelected)
      if (selectedSources.length === 0) {
        return { count: 10, reasoning: 'No sources selected — using default' }
      }

      const sourceTexts = selectedSources.map((s) => s.content)
      return aiService.suggestSlideCount(sourceTexts, args.format)
    }
  )

  // Slide Prompt Templates — CRUD
  const DEFAULT_TEMPLATE_ID = 'default-slide-template'

  // Ensure default template exists
  const ensureDefaultTemplate = async () => {
    const db = getDatabase()
    const existing = await db
      .select()
      .from(schema.slidePromptTemplates)
      .where(eq(schema.slidePromptTemplates.id, DEFAULT_TEMPLATE_ID))

    if (existing.length === 0) {
      const now = new Date().toISOString()
      await db.insert(schema.slidePromptTemplates).values({
        id: DEFAULT_TEMPLATE_ID,
        name: 'Default',
        promptText: 'Visual-first slides where text is integrated into the imagery. Use short titles and only keywords or data points when they add value. Each slide should tell its story through the visual.',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  ipcMain.handle(
    IPC_CHANNELS.SLIDE_TEMPLATES_LIST,
    async () => {
      await ensureDefaultTemplate()
      const db = getDatabase()
      return db.select().from(schema.slidePromptTemplates).orderBy(desc(schema.slidePromptTemplates.isDefault))
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SLIDE_TEMPLATES_CREATE,
    async (_event, args: { name: string; promptText: string }) => {
      const db = getDatabase()
      const now = new Date().toISOString()
      const id = randomUUID()
      await db.insert(schema.slidePromptTemplates).values({
        id,
        name: args.name,
        promptText: args.promptText,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      })
      const rows = await db.select().from(schema.slidePromptTemplates).where(eq(schema.slidePromptTemplates.id, id))
      return rows[0]
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SLIDE_TEMPLATES_UPDATE,
    async (_event, args: { id: string; name?: string; promptText?: string }) => {
      const db = getDatabase()
      const rows = await db.select().from(schema.slidePromptTemplates).where(eq(schema.slidePromptTemplates.id, args.id))
      const template = rows[0]
      if (!template) throw new Error('Template not found')
      if (template.isDefault) throw new Error('Cannot edit the default template')

      const now = new Date().toISOString()
      await db.update(schema.slidePromptTemplates).set({
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.promptText !== undefined ? { promptText: args.promptText } : {}),
        updatedAt: now,
      }).where(eq(schema.slidePromptTemplates.id, args.id))

      const updated = await db.select().from(schema.slidePromptTemplates).where(eq(schema.slidePromptTemplates.id, args.id))
      return updated[0]
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SLIDE_TEMPLATES_DELETE,
    async (_event, args: { id: string }) => {
      const db = getDatabase()
      const rows = await db.select().from(schema.slidePromptTemplates).where(eq(schema.slidePromptTemplates.id, args.id))
      const template = rows[0]
      if (!template) throw new Error('Template not found')
      if (template.isDefault) throw new Error('Cannot delete the default template')

      await db.delete(schema.slidePromptTemplates).where(eq(schema.slidePromptTemplates.id, args.id))
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
    async (_event, args: {
      imagePaths: string[]
      aspectRatio: string
      defaultName: string
      textOverlays?: Array<{
        elements: Array<{
          content: string
          x: number
          y: number
          width: number
          fontSize: number
          align: string
          color?: string
          bold?: boolean
        }>
      }>
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

      // Page dimensions in points (72pt/inch)
      const aspectDims: Record<string, [number, number]> = {
        '16:9': [960, 540],
        '4:3': [720, 540],
        '1:1': [720, 720],
        '9:16': [540, 960],
        '3:4': [540, 720],
      }
      const [pageWidth, pageHeight] = aspectDims[args.aspectRatio] || [960, 540]

      // Helper: parse hex color to rgb()
      function hexToRgb(hex: string): ReturnType<typeof rgb> {
        const clean = hex.replace('#', '')
        const r = parseInt(clean.substring(0, 2), 16) / 255
        const g = parseInt(clean.substring(2, 4), 16) / 255
        const b = parseInt(clean.substring(4, 6), 16) / 255
        return rgb(r, g, b)
      }

      // Helper: word-wrap text into lines that fit a given width
      function wrapText(text: string, font: typeof fontRegular, fontSize: number, maxWidth: number): string[] {
        const words = text.split(/\s+/)
        const lines: string[] = []
        let line = ''
        for (const word of words) {
          const test = line ? `${line} ${word}` : word
          if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) {
            lines.push(line)
            line = word
          } else {
            line = test
          }
        }
        if (line) lines.push(line)
        return lines
      }

      for (let i = 0; i < args.imagePaths.length; i++) {
        const imgPath = args.imagePaths[i]
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

          // Render text overlays for hybrid slides
          const overlay = args.textOverlays?.[i]
          if (overlay && overlay.elements.length > 0) {
            for (const el of overlay.elements) {
              if (!el.content.trim()) continue

              const font = el.bold ? fontBold : fontRegular
              // Scale fontSize from CSS px to PDF points (~0.75 ratio, then scale up for slide size)
              const pdfFontSize = Math.round(el.fontSize * 0.75 * (pageWidth / 960) * 1.8)
              const color = el.color ? hexToRgb(el.color) : rgb(0.9, 0.9, 0.9)

              // Convert percentage positions to page-point coordinates
              const elX = (el.x / 100) * pageWidth
              const elY = pageHeight - (el.y / 100) * pageHeight
              const elWidth = (el.width / 100) * pageWidth

              const lines = wrapText(el.content, font, pdfFontSize, elWidth)
              const lineHeight = pdfFontSize * 1.4

              let drawY = elY
              for (const line of lines) {
                // Alignment offset
                let drawX = elX
                if (el.align === 'center') {
                  const lineWidth = font.widthOfTextAtSize(line, pdfFontSize)
                  drawX = elX + (elWidth - lineWidth) / 2
                } else if (el.align === 'right') {
                  const lineWidth = font.widthOfTextAtSize(line, pdfFontSize)
                  drawX = elX + elWidth - lineWidth
                }

                page.drawText(line, {
                  x: drawX,
                  y: drawY,
                  size: pdfFontSize,
                  font,
                  color,
                })
                drawY -= lineHeight
              }
            }
          }
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
