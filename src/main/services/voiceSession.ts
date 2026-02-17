import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { eq } from 'drizzle-orm'
import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai'
import { configService } from './config'
import { ragService } from './rag'
import { getDatabase, schema } from '../db'

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  const apiKey = configService.getApiKey()
  if (!apiKey) throw new Error('Gemini API key not configured.')
  if (!client) client = new GoogleGenAI({ apiKey })
  return client
}

export function resetVoiceClient(): void {
  client = null
}

function broadcastToWindows(channel: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, data)
  })
}

function debugLog(sessionId: string, message: string): void {
  console.log(`[Voice Live] ${message}`)
  broadcastToWindows('voice:response-text', {
    sessionId,
    text: `[debug] ${message}`,
    type: 'debug',
  })
}

// --- Active Sessions ---

interface LiveVoiceSession {
  id: string
  notebookId: string
  session: Session | null
  active: boolean
}

const sessions = new Map<string, LiveVoiceSession>()

/**
 * Start a live voice session using Gemini Live API.
 * Opens a persistent WebSocket connection for real-time bidirectional audio.
 */
export async function startVoiceSession(notebookId: string): Promise<{ sessionId: string }> {
  const db = getDatabase()
  const sessionId = randomUUID()
  const ai = getClient()

  // Get selected sources for RAG context
  const sources = await db
    .select()
    .from(schema.sources)
    .where(eq(schema.sources.notebookId, notebookId))

  const selectedSources = sources.filter((s) => s.isSelected)
  const selectedSourceIds = selectedSources.map((s) => s.id)
  const sourceTitleMap: Record<string, string> = {}
  for (const s of sources) sourceTitleMap[s.id] = s.title

  // Build source context — use raw content for richer context in voice conversations
  let sourceContext = ''
  if (selectedSources.length > 0) {
    // First try RAG for semantic context
    try {
      const ragResult = await ragService.query(
        notebookId,
        'summarize the main topics and key information',
        selectedSourceIds,
        sourceTitleMap
      )
      sourceContext = ragResult.context
    } catch (err) {
      console.warn('[Voice Live] RAG context failed:', err)
    }

    // Supplement with raw source content for broader coverage
    const rawContext = selectedSources
      .map((s) => `[Source: ${s.title}]\n${(s.content || '').slice(0, 8000)}`)
      .join('\n\n---\n\n')

    // Combine RAG + raw content, prioritizing RAG results
    sourceContext = sourceContext
      ? `${sourceContext}\n\n--- Additional source content ---\n\n${rawContext}`.slice(0, 40000)
      : rawContext.slice(0, 40000)
  }

  // Get all sources in notebook (even unselected) for awareness
  const allSourceTitles = sources.map((s) => `- ${s.title} (${s.isSelected ? 'selected' : 'available'})`).join('\n')

  const toolsInfo = `You are part of DeepNote AI, an AI-powered notebook app. The user has these studio tools available that they can ask you about:
- Report: Generate detailed written reports
- Quiz: Create interactive quizzes with multiple choice questions
- Flashcards: Generate study flashcards
- Mind Map: Create visual mind maps of concepts
- Data Table: Generate structured data tables
- Slide Deck: Create presentation slide decks with AI-generated images
- Dashboard: Build KPI dashboards with charts and metrics
- Literature Review: Academic literature analysis
- Competitive Analysis: Business competitor comparison
- Timeline: Create visual timelines of events
- Kanban Board: Organize tasks and action items
- Chart: Generate data visualizations (bar, line, pie charts)
- Diagram: Create mermaid diagrams showing relationships
- Infographic: AI-generated visual infographics
- White Paper: In-depth technical or business documents
- Podcast: Multi-speaker audio content

If the user asks about creating any of these, explain that they can use the Studio panel to generate them from their sources.`

  const systemInstruction = sourceContext
    ? `You are a helpful, knowledgeable voice assistant for DeepNote AI. Answer concisely and conversationally — keep responses under 3 sentences when possible. Be natural and friendly.

${toolsInfo}

The user's notebook contains these sources:
${allSourceTitles}

Content from the user's selected sources:
${sourceContext.slice(0, 30000)}`
    : `You are a helpful, knowledgeable voice assistant for DeepNote AI. Answer concisely and conversationally — keep responses under 3 sentences when possible. Be natural and friendly.

${toolsInfo}

The user has no sources selected in their current notebook. Suggest they add or select sources to get source-aware answers.`

  // Register session before connecting (renderer needs sessionId immediately)
  const voiceSession: LiveVoiceSession = {
    id: sessionId,
    notebookId,
    session: null,
    active: true,
  }
  sessions.set(sessionId, voiceSession)

  // Connect to Gemini Live API asynchronously
  connectLiveSession(ai, sessionId, systemInstruction).catch((err) => {
    console.error('[Voice Live] Connection failed:', err)
    broadcastToWindows('voice:response-text', {
      sessionId,
      text: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      type: 'error',
    })
  })

  return { sessionId }
}

async function connectLiveSession(
  ai: GoogleGenAI,
  sessionId: string,
  systemInstruction: string
): Promise<void> {
  const voiceSession = sessions.get(sessionId)
  if (!voiceSession || !voiceSession.active) return

  const modelName = 'gemini-2.5-flash-native-audio-preview-12-2025'
  debugLog(sessionId, `Connecting to Gemini Live API with model: ${modelName}`)
  const session = await ai.live.connect({
    model: modelName,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks: {
      onopen: () => {
        debugLog(sessionId, 'WebSocket connected')
      },
      onmessage: (msg: LiveServerMessage) => {
        handleLiveMessage(sessionId, msg)
      },
      onerror: (err: unknown) => {
        let errStr: string
        try {
          errStr = JSON.stringify(err, Object.getOwnPropertyNames(err instanceof Error ? err : {}))
        } catch {
          errStr = String(err)
        }
        debugLog(sessionId, `WebSocket ERROR: ${errStr}`)
        broadcastToWindows('voice:response-text', {
          sessionId,
          text: `Connection error: ${err instanceof Error ? err.message : String(err)}`,
          type: 'error',
        })
      },
      onclose: (ev: unknown) => {
        let closeStr: string
        try {
          closeStr = JSON.stringify(ev)
        } catch {
          closeStr = String(ev)
        }
        debugLog(sessionId, `WebSocket CLOSED: ${closeStr}`)
        const s = sessions.get(sessionId)
        if (s) s.active = false
      },
    },
  })

  // Session is now fully ready — assign it and THEN notify renderer
  voiceSession.session = session
  debugLog(sessionId, 'Session fully initialized, ready to receive audio')
  broadcastToWindows('voice:response-text', {
    sessionId,
    text: '',
    type: 'ready',
  })
}

let msgCount = 0

function handleLiveMessage(sessionId: string, msg: LiveServerMessage): void {
  msgCount++

  // Log first message shape for debugging
  if (msgCount === 1) {
    const keys = Object.keys(msg).filter((k) => (msg as unknown as Record<string, unknown>)[k] != null)
    debugLog(sessionId, `First msg keys: [${keys.join(', ')}]`)
  }

  const content = msg.serverContent

  if (content) {
    // Handle audio response chunks from model
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data && part.inlineData.mimeType) {
          broadcastToWindows('voice:response-audio', {
            sessionId,
            audioData: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
          })
        }
      }
    }

    // Handle input transcription (what the user said)
    if (content.inputTranscription?.text) {
      debugLog(sessionId, `Input transcript: "${content.inputTranscription.text}"`)
      broadcastToWindows('voice:response-text', {
        sessionId,
        text: content.inputTranscription.text,
        type: 'input',
      })
    }

    // Handle output transcription (what the AI said)
    if (content.outputTranscription?.text) {
      debugLog(sessionId, `Output transcript: "${content.outputTranscription.text}"`)
      broadcastToWindows('voice:response-text', {
        sessionId,
        text: content.outputTranscription.text,
        type: 'output',
      })
    }

    // Handle turn completion
    if (content.turnComplete) {
      debugLog(sessionId, 'Turn complete')
      broadcastToWindows('voice:turn-complete', { sessionId })
    }

    // Handle interruption
    if (content.interrupted) {
      debugLog(sessionId, 'Interrupted')
      broadcastToWindows('voice:interrupted', { sessionId })
    }
  }

  // Handle setupComplete
  if (msg.setupComplete) {
    debugLog(sessionId, 'Setup complete')
  }
}

/**
 * Send a real-time audio chunk to the live session.
 * Audio should be PCM 16-bit mono at 16kHz, base64-encoded.
 */
let chunkCount = 0

export function sendAudioChunk(sessionId: string, audioBase64: string): void {
  const voiceSession = sessions.get(sessionId)
  if (!voiceSession?.session || !voiceSession.active) {
    chunkCount++
    if (chunkCount <= 3) {
      debugLog(sessionId, `Audio chunk #${chunkCount} DROPPED (session not ready yet)`)
    }
    return
  }

  chunkCount++
  if (chunkCount === 1) {
    debugLog(sessionId, 'Sending audio chunks...')
  }

  try {
    voiceSession.session.sendRealtimeInput({
      audio: {
        data: audioBase64,
        mimeType: 'audio/pcm;rate=16000',
      },
    })
  } catch (err) {
    debugLog(sessionId, `Failed to send chunk: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Stop a voice session and close the WebSocket.
 */
export function stopVoiceSession(sessionId: string): void {
  const voiceSession = sessions.get(sessionId)
  if (voiceSession) {
    voiceSession.active = false
    if (voiceSession.session) {
      try {
        voiceSession.session.conn.close()
      } catch {
        // Already closed
      }
    }
    sessions.delete(sessionId)
    // Reset chunk counter for next session
    chunkCount = 0
    msgCount = 0
  }
}
