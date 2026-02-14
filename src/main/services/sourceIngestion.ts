import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db'
import { documentParserService } from './documentParser'
import { chunkerService } from './chunker'
import { embeddingsService } from './embeddings'
import { vectorStoreService } from './vectorStore'
import { aiService } from './ai'
import type { SourceType, Source } from '../../shared/types'

interface IngestArgs {
  notebookId: string
  type: SourceType
  filePath?: string
  content?: string
  title?: string
  url?: string
}

export async function ingestSource(args: IngestArgs): Promise<Source> {
  const db = getDatabase()
  const now = new Date().toISOString()
  const sourceId = randomUUID()

  // Step 1: Parse document based on type
  let parsedText = ''
  let parsedTitle = args.title || 'Untitled source'
  try {
    switch (args.type) {
      case 'pdf': {
        if (!args.filePath) throw new Error('File path required for PDF')
        const result = await documentParserService.parsePDF(args.filePath)
        parsedText = result.text
        parsedTitle = args.title || result.title
        break
      }
      case 'docx': {
        if (!args.filePath) throw new Error('File path required for DOCX')
        const result = await documentParserService.parseDocx(args.filePath)
        parsedText = result.text
        parsedTitle = args.title || result.title
        break
      }
      case 'txt':
      case 'md': {
        if (!args.filePath) throw new Error('File path required for text file')
        const result = await documentParserService.parseText(args.filePath)
        parsedText = result.text
        parsedTitle = args.title || result.title
        break
      }
      case 'url': {
        if (!args.url) throw new Error('URL required')
        const result = await documentParserService.parseUrl(args.url)
        parsedText = result.text
        parsedTitle = args.title || result.title
        break
      }
      case 'paste': {
        parsedText = args.content || ''
        parsedTitle = args.title || `Pasted text (${new Date().toLocaleDateString()})`
        break
      }
      case 'youtube': {
        if (!args.url) throw new Error('YouTube URL required')
        const result = await documentParserService.parseYoutube(args.url)
        parsedText = result.text
        parsedTitle = args.title || result.title
        break
      }
      case 'audio': {
        if (!args.filePath) throw new Error('File path required for audio')
        const result = await documentParserService.parseAudio(args.filePath)
        parsedText = result.text
        parsedTitle = args.title || result.title
        break
      }
      case 'xlsx':
      case 'csv': {
        if (!args.filePath) throw new Error('File path required for spreadsheet')
        const result = await documentParserService.parseExcel(args.filePath)
        parsedText = result.text
        parsedTitle = args.title || result.title
        break
      }
      case 'image': {
        if (!args.filePath) throw new Error('File path required for image')
        const result = await documentParserService.parseImage(args.filePath)
        parsedText = result.text
        parsedTitle = args.title || result.title
        break
      }
      case 'pptx': {
        if (!args.filePath) throw new Error('File path required for PowerPoint')
        const result = await documentParserService.parsePptx(args.filePath)
        parsedText = result.text
        parsedTitle = args.title || result.title
        break
      }
      default:
        parsedText = args.content || ''
    }
  } catch (err) {
    throw new Error(`Failed to parse document: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  if (!parsedText.trim()) {
    throw new Error('No text could be extracted from this source.')
  }

  // Step 2: Chunk the parsed text
  const isTabular = args.type === 'xlsx' || args.type === 'csv'
  const chunkResults = isTabular
    ? chunkerService.chunkTabular(parsedText)
    : chunkerService.chunk(parsedText)
  const chunkTexts = chunkResults.map((c) => c.text)

  // Step 3: Kick off embeddings AND source guide in parallel (both are API calls)
  const embeddingsPromise = embeddingsService.embed(chunkTexts).catch((err) => {
    console.warn('[Sources] Embeddings failed, saving source without vectors:', err)
    return [] as number[][]
  })
  const sourceGuidePromise = aiService.generateSourceGuide(parsedText).catch((err) => {
    console.warn('[Sources] Failed to generate source guide:', err)
    return null as string | null
  })

  // Step 4: While API calls are in-flight, do DB inserts (instant)
  const source: Source = {
    id: sourceId,
    notebookId: args.notebookId,
    title: parsedTitle,
    filename: args.filePath?.split('/').pop() || null,
    type: args.type,
    content: parsedText.slice(0, 50000),
    rawFilePath: args.filePath || null,
    isSelected: true,
    sourceGuide: null,
    createdAt: now,
  }

  await db.insert(schema.sources).values(source)

  // Step 5: Store chunks in SQLite
  const chunkRecords = chunkResults.map((c) => ({
    id: randomUUID(),
    sourceId,
    text: c.text,
    pageNumber: c.pageNumber ?? null,
    chunkIndex: c.index,
    tokenCount: c.tokenCount,
    createdAt: now,
  }))

  if (chunkRecords.length > 0) {
    await db.insert(schema.chunks).values(chunkRecords)
  }

  // Update notebook's updatedAt
  await db
    .update(schema.notebooks)
    .set({ updatedAt: now })
    .where(eq(schema.notebooks.id, args.notebookId))

  // Step 6: Await embeddings (started in step 3), store vectors
  const vectors = await embeddingsPromise
  if (vectors.length > 0 && vectors.length === chunkRecords.length) {
    await vectorStoreService.addDocuments(
      args.notebookId,
      sourceId,
      chunkRecords.map((c) => ({
        text: c.text,
        id: c.id,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber ?? undefined,
      })),
      vectors
    )
  }

  // Step 7: Source guide — save when ready (fire-and-forget)
  sourceGuidePromise.then(async (guide) => {
    if (!guide) return
    try {
      const currentDb = getDatabase()
      await currentDb
        .update(schema.sources)
        .set({ sourceGuide: guide })
        .where(eq(schema.sources.id, sourceId))
    } catch (err) {
      console.warn('[Sources] Failed to save source guide:', err)
    }
  })

  return source
}
