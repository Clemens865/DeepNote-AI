import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { ragService } from '../services/rag'
import { aiService } from '../services/ai'

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
          sourceTitleMap
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
      })
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

    return assistantMessage
  })

  ipcMain.handle(IPC_CHANNELS.CHAT_CLEAR, async (_event, notebookId: string) => {
    const db = getDatabase()
    await db
      .delete(schema.chatMessages)
      .where(eq(schema.chatMessages.notebookId, notebookId))
  })
}
