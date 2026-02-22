import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { ragService } from '../services/rag'
import { aiService, buildSystemPrompt } from '../services/ai'
import { memoryService } from '../services/memory'
import { deepbrainService } from '../services/deepbrain'
import { configService } from '../services/config'
import { getChatProvider } from '../services/providers'
import type { ChatProviderType } from '../../shared/providers'
import type { DeepBrainResults } from '../../shared/types'

export function registerChatHandlers() {
  ipcMain.handle(IPC_CHANNELS.CHAT_MESSAGES, async (_event, notebookId: string) => {
    const db = getDatabase()
    const rows = await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.notebookId, notebookId))

    return rows.map((row) => {
      const metadata = row.metadata as Record<string, unknown> | null
      return {
        ...row,
        deepbrainResults: metadata?.deepbrainResults as DeepBrainResults | undefined,
      }
    })
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

    // DeepBrain: recall memories + search files + emails in parallel (gracefully skips if offline or disabled)
    const sbEnabled = configService.getAll().deepbrainEnabled !== false
    let deepbrainContext = ''
    let deepbrainConnected = false
    let deepbrainResults: DeepBrainResults | undefined
    try {
      if (sbEnabled) {
        deepbrainConnected = await deepbrainService.isAvailable()
      }
      if (deepbrainConnected) {
        const [sbMemories, sbFiles, sbEmails, sbActivity] = await Promise.all([
          deepbrainService.recall(args.message, 8).catch(() => []),
          deepbrainService.searchFiles(args.message, 5).catch(() => []),
          deepbrainService.searchEmails(args.message, 5).catch(() => []),
          deepbrainService.getActivityCurrent().catch(() => null),
        ])

        // Store results for UI preview cards
        deepbrainResults = {
          memories: sbMemories,
          files: sbFiles,
          emails: sbEmails,
        }

        const sbParts: string[] = []

        if (sbMemories.length > 0) {
          sbParts.push('System memories:')
          for (const m of sbMemories) {
            sbParts.push(`  [${m.memoryType}] ${m.content}`)
          }
          console.log(`[Chat] DeepBrain provided ${sbMemories.length} memories`)
        }

        if (sbFiles.length > 0) {
          sbParts.push('System files (emails, documents, indexed files):')
          for (const f of sbFiles) {
            sbParts.push(`  [File: ${f.name}] (${f.path})\n  ${f.chunk}`)
          }
          console.log(`[Chat] DeepBrain provided ${sbFiles.length} file matches`)
        }

        if (sbEmails.length > 0) {
          sbParts.push('Emails:')
          for (const e of sbEmails) {
            sbParts.push(`  [Email] "${e.subject}" from ${e.sender} (${e.date})\n  ${e.chunk}`)
          }
          console.log(`[Chat] DeepBrain provided ${sbEmails.length} email matches`)
        }

        // Activity context — tell AI what user is currently working on
        if (sbActivity) {
          sbParts.push(`User activity: Currently using ${sbActivity.app}${sbActivity.file ? ` — editing ${sbActivity.file}` : ` — window: ${sbActivity.window}`}`)
        }

        if (sbParts.length > 0) {
          deepbrainContext = `\n\n--- SYSTEM-WIDE DATA (DeepBrain connected) ---\nYou DO have access to the user's system files, emails, clipboard history, and cross-app memories through DeepBrain. The following data was found for this query:\n${sbParts.join('\n')}`
        } else {
          deepbrainContext = `\n\n--- SYSTEM-WIDE DATA (DeepBrain connected) ---\nDeepBrain is connected but found no matching files or memories for this query. The user's emails and files ARE searchable — this query just didn't match any indexed content. Suggest the user check if their emails/files are indexed in DeepBrain.`
        }
      }
    } catch {
      // DeepBrain offline
    }

    // Only include results if non-empty
    if (deepbrainResults && !deepbrainResults.memories.length && !deepbrainResults.files.length && !deepbrainResults.emails.length) {
      deepbrainResults = undefined
    }

    // Tell the AI about DeepBrain status so it doesn't say "I can't access your files"
    if (!deepbrainConnected) {
      deepbrainContext = `\n\n--- SYSTEM-WIDE DATA ---\nDeepBrain is not running. You cannot access system files or emails right now. Tell the user to start DeepBrain to enable system-wide search across emails, files, and apps.`
    }

    // Combine RAG context with DeepBrain context
    context = context + deepbrainContext

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

    // Call AI service with streaming via provider factory
    let responseText: string
    try {
      const { chatProvider: providerType, chatModel } = configService.getAll()
      const provider = getChatProvider(
        (providerType || 'gemini') as ChatProviderType,
        chatModel || 'gemini-2.5-flash',
        configService
      )
      const systemPrompt = await buildSystemPrompt(context, {
        description: notebook?.description,
        responseLength: notebook?.responseLength,
        hasSpreadsheetSources,
      }, args.notebookId, sbEnabled)

      responseText = await provider.chatStream(recentHistory, systemPrompt, (chunk) => {
        _event.sender.send('chat:stream-chunk', { messageId: assistantId, chunk })
      })
    } catch (err) {
      responseText = `Error: ${err instanceof Error ? err.message : 'Failed to generate response. Please check your API key in Settings.'}`
      citations = []
    }

    // Save assistant message (with optional DeepBrain metadata)
    const assistantMessage = {
      id: assistantId,
      notebookId: args.notebookId,
      role: 'assistant' as const,
      content: responseText,
      citations,
      deepbrainResults,
      createdAt: new Date().toISOString(),
    }
    await db.insert(schema.chatMessages).values({
      ...assistantMessage,
      citations: JSON.stringify(assistantMessage.citations),
      metadata: deepbrainResults ? JSON.stringify({ deepbrainResults }) : null,
    })

    // Fire-and-forget: extract memories from conversation
    memoryService.extractMemoriesFromChat(
      args.notebookId,
      recentHistory.concat([{ role: 'assistant', content: responseText }])
    ).catch((err) => console.warn('[Chat] Memory extraction failed:', err))

    // Fire-and-forget: store Q&A in DeepBrain as episodic memory
    if (sbEnabled) {
      deepbrainService.remember(
        `[DeepNote Chat | ${notebook?.title || args.notebookId}] Q: ${args.message}\nA: ${responseText.slice(0, 500)}`,
        'episodic',
        0.6
      ).catch(() => { /* DeepBrain offline — silently skip */ })
    }

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
