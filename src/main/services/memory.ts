import { randomUUID } from 'crypto'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { GoogleGenAI } from '@google/genai'
import { getDatabase, schema } from '../db'
import { configService } from './config'

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  const apiKey = configService.getApiKey()
  if (!apiKey) throw new Error('Gemini API key not configured.')
  if (!client) client = new GoogleGenAI({ apiKey })
  return client
}

export function resetMemoryClient(): void {
  client = null
}

// --- Types ---

export interface UserMemory {
  id: string
  notebookId: string | null
  type: 'preference' | 'learning' | 'context' | 'feedback'
  key: string
  value: string
  confidence: number
  lastUsedAt: string
  createdAt: string
  updatedAt: string
}

// --- Service ---

export class MemoryService {
  /**
   * Store or update a memory by key + notebookId.
   */
  async store(memory: {
    notebookId?: string | null
    type: UserMemory['type']
    key: string
    value: string
    confidence?: number
  }): Promise<void> {
    const db = getDatabase()
    const now = new Date().toISOString()

    // Check for existing memory with same key and notebookId
    const existing = await db
      .select()
      .from(schema.userMemory)
      .where(
        and(
          eq(schema.userMemory.key, memory.key),
          memory.notebookId
            ? eq(schema.userMemory.notebookId, memory.notebookId)
            : isNull(schema.userMemory.notebookId)
        )
      )

    if (existing.length > 0) {
      // Update existing
      await db
        .update(schema.userMemory)
        .set({
          value: memory.value,
          confidence: memory.confidence ?? existing[0].confidence,
          lastUsedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.userMemory.id, existing[0].id))
    } else {
      // Insert new
      await db.insert(schema.userMemory).values({
        id: randomUUID(),
        notebookId: memory.notebookId ?? null,
        type: memory.type,
        key: memory.key,
        value: memory.value,
        confidence: memory.confidence ?? 0.5,
        lastUsedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  /**
   * Build a formatted memory context for system prompts.
   */
  async buildMemoryContext(notebookId?: string): Promise<string> {
    const db = getDatabase()

    // Get global memories + notebook-specific memories
    const globalMemories = await db
      .select()
      .from(schema.userMemory)
      .where(isNull(schema.userMemory.notebookId))
      .orderBy(desc(schema.userMemory.lastUsedAt))
      .limit(20)

    let notebookMemories: typeof globalMemories = []
    if (notebookId) {
      notebookMemories = await db
        .select()
        .from(schema.userMemory)
        .where(eq(schema.userMemory.notebookId, notebookId))
        .orderBy(desc(schema.userMemory.lastUsedAt))
        .limit(20)
    }

    const all = [...globalMemories, ...notebookMemories]
    if (all.length === 0) return ''

    // Filter by confidence threshold
    const relevant = all.filter((m) => (m.confidence ?? 0.5) >= 0.3)
    if (relevant.length === 0) return ''

    const lines = relevant.map((m) => {
      const scope = m.notebookId ? '(notebook)' : '(global)'
      return `- [${m.type}] ${scope} ${m.key}: ${m.value}`
    })

    return `\n\nYour memory about this user's preferences and patterns:\n${lines.join('\n')}`
  }

  /**
   * Extract memories from a chat conversation using AI.
   */
  async extractMemoriesFromChat(
    notebookId: string,
    messages: { role: string; content: string }[]
  ): Promise<void> {
    if (messages.length < 2) return

    // Only analyze last few exchanges
    const recentMessages = messages.slice(-6)
    const conversationText = recentMessages
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join('\n')

    try {
      const ai = getClient()
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Analyze this conversation and extract any user preferences, learning patterns, or important context worth remembering for future conversations. Only extract CLEAR, DEFINITE preferences — do not guess.

Conversation:
${conversationText}

Output a JSON array of memories to store. Each memory has:
- "type": "preference" | "learning" | "context" | "feedback"
- "key": short descriptive key (e.g., "preferred_format", "difficulty_level", "topic_interest")
- "value": the actual preference or pattern
- "confidence": 0.0-1.0 how confident you are

If there's nothing worth remembering, output an empty array [].
Output ONLY valid JSON, no markdown fences.`,
              },
            ],
          },
        ],
      })

      const raw = (response.text ?? '[]')
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      const memories = JSON.parse(raw)
      if (!Array.isArray(memories)) return

      for (const mem of memories) {
        if (mem.key && mem.value && mem.confidence >= 0.4) {
          await this.store({
            notebookId,
            type: mem.type || 'preference',
            key: mem.key,
            value: mem.value,
            confidence: mem.confidence,
          })
        }
      }
    } catch (err) {
      console.warn('[Memory] Failed to extract memories:', err)
    }
  }

  /**
   * List all memories, optionally filtered by notebookId.
   */
  async list(notebookId?: string | null): Promise<UserMemory[]> {
    const db = getDatabase()

    if (notebookId === undefined) {
      // Return all memories
      return db
        .select()
        .from(schema.userMemory)
        .orderBy(desc(schema.userMemory.lastUsedAt)) as Promise<UserMemory[]>
    }

    if (notebookId === null) {
      // Global only
      return db
        .select()
        .from(schema.userMemory)
        .where(isNull(schema.userMemory.notebookId))
        .orderBy(desc(schema.userMemory.lastUsedAt)) as Promise<UserMemory[]>
    }

    // Notebook-specific + global
    const notebook = await db
      .select()
      .from(schema.userMemory)
      .where(eq(schema.userMemory.notebookId, notebookId))
      .orderBy(desc(schema.userMemory.lastUsedAt))

    const global = await db
      .select()
      .from(schema.userMemory)
      .where(isNull(schema.userMemory.notebookId))
      .orderBy(desc(schema.userMemory.lastUsedAt))

    return [...notebook, ...global] as UserMemory[]
  }

  /**
   * Delete a specific memory.
   */
  async delete(id: string): Promise<void> {
    const db = getDatabase()
    await db.delete(schema.userMemory).where(eq(schema.userMemory.id, id))
  }

  /**
   * Clear all memories, optionally for a specific notebook.
   */
  async clear(notebookId?: string | null): Promise<void> {
    const db = getDatabase()

    if (notebookId === undefined) {
      // Clear all
      await db.delete(schema.userMemory)
    } else if (notebookId === null) {
      // Clear global only
      await db.delete(schema.userMemory).where(isNull(schema.userMemory.notebookId))
    } else {
      await db
        .delete(schema.userMemory)
        .where(eq(schema.userMemory.notebookId, notebookId))
    }
  }
}

export const memoryService = new MemoryService()
