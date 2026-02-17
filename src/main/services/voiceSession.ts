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

  // Get RAG context from selected sources
  let ragContext = ''
  if (selectedSourceIds.length > 0) {
    try {
      const ragResult = await ragService.query(
        notebookId,
        'summarize the main topics and key information',
        selectedSourceIds,
        sourceTitleMap
      )
      ragContext = ragResult.context
    } catch (err) {
      console.warn('[Voice Live] RAG context failed:', err)
      ragContext = selectedSources
        .map((s) => `[${s.title}]\n${(s.content || '').slice(0, 5000)}`)
        .join('\n\n---\n\n')
        .slice(0, 30000)
    }
  }

  const systemInstruction = ragContext
    ? `You are a helpful voice assistant. Answer concisely and conversationally — keep responses under 3 sentences when possible. Be natural and friendly.\n\nContext from user's sources:\n${ragContext.slice(0, 20000)}`
    : 'You are a helpful voice assistant. Answer concisely and conversationally — keep responses under 3 sentences when possible. Be natural and friendly.'

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

  const session = await ai.live.connect({
    model: 'gemini-live-2.5-flash-preview',
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
    callbacks: {
      onopen: () => {
        console.log('[Voice Live] WebSocket connected for session', sessionId)
        broadcastToWindows('voice:response-text', {
          sessionId,
          text: '',
          type: 'ready',
        })
      },
      onmessage: (msg: LiveServerMessage) => {
        handleLiveMessage(sessionId, msg)
      },
      onerror: (err) => {
        console.error('[Voice Live] WebSocket error:', err)
        broadcastToWindows('voice:response-text', {
          sessionId,
          text: 'Connection error occurred.',
          type: 'error',
        })
      },
      onclose: () => {
        console.log('[Voice Live] WebSocket closed for session', sessionId)
        const s = sessions.get(sessionId)
        if (s) s.active = false
      },
    },
  })

  voiceSession.session = session
}

function handleLiveMessage(sessionId: string, msg: LiveServerMessage): void {
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
      broadcastToWindows('voice:response-text', {
        sessionId,
        text: content.inputTranscription.text,
        type: 'input',
      })
    }

    // Handle output transcription (what the AI said)
    if (content.outputTranscription?.text) {
      broadcastToWindows('voice:response-text', {
        sessionId,
        text: content.outputTranscription.text,
        type: 'output',
      })
    }

    // Handle turn completion
    if (content.turnComplete) {
      broadcastToWindows('voice:turn-complete', { sessionId })
    }

    // Handle interruption
    if (content.interrupted) {
      broadcastToWindows('voice:interrupted', { sessionId })
    }
  }
}

/**
 * Send a real-time audio chunk to the live session.
 * Audio should be PCM 16-bit mono at 16kHz, base64-encoded.
 */
export function sendAudioChunk(sessionId: string, audioBase64: string): void {
  const voiceSession = sessions.get(sessionId)
  if (!voiceSession?.session || !voiceSession.active) return

  try {
    voiceSession.session.sendRealtimeInput({
      audio: {
        data: audioBase64,
        mimeType: 'audio/pcm;rate=16000',
      },
    })
  } catch (err) {
    console.error('[Voice Live] Failed to send audio chunk:', err)
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
  }
}
