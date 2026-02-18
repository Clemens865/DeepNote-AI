import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { ragService } from '../services/rag'
import { aiService } from '../services/ai'
import { memoryService } from '../services/memory'
import { superbrainService } from '../services/superbrain'

export function registerChatHandlers() {
  ipcMain.handle(IPC_CHANNELS.CHAT_MESSAGES, async (_event, notebookId: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.notebookId, notebookId))
  })

  ipcMain.handle(IPC_CHANNELS.CHAT_SEND, async (_event, args: {
    notebookId: string
    message: string
  }) => {
    const db = getDatabase()
    const now = new Date().toISOString()

    // Save user message
    const userMessage = {
      id: randomUUID(),
      notebookId: args.notebookId,
      role: 'user' as const,
      content: args.message,
      citations: [],
      createdAt: now,
    }
    await db.insert(schema.chatMessages).values({
      ...userMessage,
      citations: JSON.stringify(userMessage.citations),
    })

    // Get selected sources for RAG
    const sources = await db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.notebookId, args.notebookId))

    const selectedSources = sources.filter((s) => s.isSelected)
    const hasSpreadsheetSources = selectedSources.some(
      (s) => s.type === 'xlsx' || s.type === 'csv'
    )
    const selectedSourceIds = selectedSources.map((s) => s.id)
    const sourceTitleMap: Record<string, string> = {}
    for (const s of sources) {
      sourceTitleMap[s.id] = s.title
    }

    // Get notebook for config
    const notebooks = await db
      .select()
      .from(schema.notebooks)
      .where(eq(schema.notebooks.id, args.notebookId))
    const notebook = notebooks[0]

    // Get RAG context
    let context = ''
    let citations: { sourceId: string; sourceTitle: string; chunkText: string; pageNumber?: number }[] = []
    if (selectedSourceIds.length > 0) {
      try {
        const ragResult = await ragService.query(
          args.notebookId,
          args.message,
          selectedSourceIds,
          sourceTitleMap,
          { agentic: true }
        )
        context = ragResult.context
        citations = ragResult.citations
      } catch (err) {
        console.warn('[Chat] RAG query failed:', err)
      }

      // Fallback: if RAG returned no context (e.g. embeddings failed during upload),
      // use the raw source content stored in the DB
      if (!context && selectedSources.length > 0) {
        console.log('[Chat] RAG empty, falling back to raw source content')
        const parts = selectedSources.map((s) =>
          `[Source: ${s.title}]\n${(s.content || '').slice(0, 15000)}`
        )
        context = parts.join('\n\n---\n\n').slice(0, 60000)
      }
    }

    // SuperBrain: recall memories + search files in parallel (gracefully skips if offline)
    let superbrainContext = ''
    try {
      const [sbMemories, sbFiles] = await Promise.all([
        superbrainService.recall(args.message, 8).catch(() => []),
        superbrainService.searchFiles(args.message, 5).catch(() => []),
      ])

      const sbParts: string[] = []

      if (sbMemories.length > 0) {
        sbParts.push('System memories:')
        for (const m of sbMemories) {
          sbParts.push(`  [${m.memoryType}] ${m.content}`)
        }
        console.log(`[Chat] SuperBrain provided ${sbMemories.length} memories`)
      }

      if (sbFiles.length > 0) {
        sbParts.push('System files (emails, documents, indexed files):')
        for (const f of sbFiles) {
          sbParts.push(`  [File: ${f.name}] (${f.path})\n  ${f.chunk}`)
        }
        console.log(`[Chat] SuperBrain provided ${sbFiles.length} file matches`)
      }

      if (sbParts.length > 0) {
        superbrainContext = `\n\n--- System-wide context (from SuperBrain — includes emails, files, clipboard, app memories) ---\n${sbParts.join('\n')}`
      }
    } catch {
      // SuperBrain offline — continue without system-wide context
    }

    // Combine RAG context with SuperBrain context
    if (superbrainContext) {
      context = context + superbrainContext
    }

    // Get chat history for context
    const history = await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.notebookId, args.notebookId))

    // Build messages for AI (last 20 messages for context)
    const recentHistory = history.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }))
    // Add current message
    recentHistory.push({ role: 'user', content: args.message })

    // Generate a message ID upfront for streaming
    const assistantId = randomUUID()

    // Call AI service with streaming
    let responseText: string
    try {
      responseText = await aiService.chatStream(recentHistory, context, {
        description: notebook?.description,
        responseLength: notebook?.responseLength,
        hasSpreadsheetSources,
      }, (chunk) => {
        _event.sender.send('chat:stream-chunk', { messageId: assistantId, chunk })
      }, args.notebookId)
    } catch (err) {
      responseText = `Error: ${err instanceof Error ? err.message : 'Failed to generate response. Please check your API key in Settings.'}`
      citations = []
    }

    // Save assistant message
    const assistantMessage = {
      id: assistantId,
      notebookId: args.notebookId,
      role: 'assistant' as const,
      content: responseText,
      citations,
      createdAt: new Date().toISOString(),
    }
    await db.insert(schema.chatMessages).values({
      ...assistantMessage,
      citations: JSON.stringify(assistantMessage.citations),
    })

    // Fire-and-forget: extract memories from conversation
    memoryService.extractMemoriesFromChat(
      args.notebookId,
      recentHistory.concat([{ role: 'assistant', content: responseText }])
    ).catch((err) => console.warn('[Chat] Memory extraction failed:', err))

    // Fire-and-forget: store Q&A in SuperBrain as episodic memory
    superbrainService.remember(
      `[DeepNote Chat | ${notebook?.title || args.notebookId}] Q: ${args.message}\nA: ${responseText.slice(0, 500)}`,
      'episodic',
      0.6
    ).catch(() => { /* SuperBrain offline — silently skip */ })

    return assistantMessage
  })

  // Save a single message (used by voice transcription)
  ipcMain.handle(
    IPC_CHANNELS.CHAT_SAVE_MESSAGE,
    async (_event, args: { notebookId: string; role: 'user' | 'assistant'; content: string }) => {
      const db = getDatabase()
      const msg = {
        id: randomUUID(),
        notebookId: args.notebookId,
        role: args.role,
        content: args.content,
        citations: JSON.stringify([]),
        createdAt: new Date().toISOString(),
      }
      await db.insert(schema.chatMessages).values(msg)
      return { ...msg, citations: [] }
    }
  )

  // Chat-to-Source: generate content from a chat response
  ipcMain.handle(
    IPC_CHANNELS.CHAT_GENERATE_FROM_CONTEXT,
    async (_event, args: { notebookId: string; content: string; type: string }) => {
      const db = getDatabase()
      const now = new Date().toISOString()

      // Create a temporary paste source from the chat content
      const sourceId = randomUUID()
      await db.insert(schema.sources).values({
        id: sourceId,
        notebookId: args.notebookId,
        title: `Chat Context - ${new Date().toLocaleString()}`,
        filename: null,
        type: 'paste',
        content: args.content,
        rawFilePath: null,
        isSelected: true,
        sourceGuide: null,
        createdAt: now,
      })

      // Generate content using the chat context as source
      const result = await aiService.generateContent(args.type, [args.content])

      const contentId = randomUUID()
      const TYPE_TITLES: Record<string, string> = {
        report: 'Report', quiz: 'Quiz', flashcard: 'Flashcards', mindmap: 'Mind Map',
        datatable: 'Data Table', slides: 'Slide Deck', dashboard: 'Dashboard',
        'literature-review': 'Literature Review', 'competitive-analysis': 'Competitive Analysis',
      }

      const record = {
        id: contentId,
        notebookId: args.notebookId,
        type: args.type as 'report',
        title: `${TYPE_TITLES[args.type] || args.type} from Chat - ${new Date().toLocaleDateString()}`,
        data: JSON.stringify(result),
        sourceIds: JSON.stringify([sourceId]),
        status: 'completed' as const,
        createdAt: now,
      }
      await db.insert(schema.generatedContent).values(record)

      return {
        id: contentId,
        notebookId: args.notebookId,
        type: args.type,
        title: record.title,
        data: result,
        sourceIds: [sourceId],
        status: 'completed',
        createdAt: now,
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.CHAT_CLEAR, async (_event, notebookId: string) => {
    const db = getDatabase()
    await db
      .delete(schema.chatMessages)
      .where(eq(schema.chatMessages.notebookId, notebookId))
  })
}
