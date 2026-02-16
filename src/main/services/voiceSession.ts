import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { eq } from 'drizzle-orm'
import { GoogleGenAI } from '@google/genai'
import { configService } from './config'
import { ragService } from './rag'
import { ttsService } from './tts'
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

interface VoiceSessionState {
  id: string
  notebookId: string
  ragContext: string
  active: boolean
}

const sessions = new Map<string, VoiceSessionState>()

/**
 * Start a voice session.
 * Loads RAG context for the notebook to use as system instruction.
 */
export async function startVoiceSession(notebookId: string): Promise<{ sessionId: string }> {
  const db = getDatabase()
  const sessionId = randomUUID()

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
      console.warn('[Voice] RAG context failed:', err)
      // Fallback: use raw source content
      ragContext = selectedSources
        .map((s) => `[${s.title}]\n${(s.content || '').slice(0, 5000)}`)
        .join('\n\n---\n\n')
        .slice(0, 30000)
    }
  }

  const session: VoiceSessionState = {
    id: sessionId,
    notebookId,
    ragContext,
    active: true,
  }
  sessions.set(sessionId, session)

  return { sessionId }
}

/**
 * Process audio input — fallback approach:
 * Transcribe audio → text chat → TTS response
 */
export async function processAudioInput(
  sessionId: string,
  audioBase64: string
): Promise<void> {
  const session = sessions.get(sessionId)
  if (!session || !session.active) {
    throw new Error('Voice session not found or inactive')
  }

  const ai = getClient()

  try {
    // Step 1: Transcribe audio using Gemini
    const transcribeResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this audio. Output ONLY the transcribed text, nothing else.',
            },
          ],
        },
      ],
    })

    const transcribedText = transcribeResponse.text?.trim()
    if (!transcribedText) {
      broadcastToWindows('voice:response-text', {
        sessionId,
        text: "I couldn't understand the audio. Please try again.",
      })
      return
    }

    // Broadcast the transcription
    broadcastToWindows('voice:response-text', {
      sessionId,
      text: `You said: ${transcribedText}`,
    })

    // Step 2: Generate AI response with RAG context
    const systemPrompt = session.ragContext
      ? `You are a helpful voice assistant. Answer concisely and conversationally — keep responses under 3 sentences when possible.\n\nContext from user's sources:\n${session.ragContext.slice(0, 20000)}`
      : 'You are a helpful voice assistant. Answer concisely and conversationally — keep responses under 3 sentences when possible.'

    const chatResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      config: { systemInstruction: systemPrompt },
      contents: [{ role: 'user', parts: [{ text: transcribedText }] }],
    })

    const responseText = chatResponse.text ?? 'I could not generate a response.'

    // Broadcast the text response
    broadcastToWindows('voice:response-text', {
      sessionId,
      text: responseText,
    })

    // Step 3: Convert response to speech using existing TTS service
    try {
      const script = {
        speakers: [{ name: 'Assistant', voice: 'Kore' }],
        turns: [{ speaker: 'Assistant', text: responseText }],
      }
      const { audioPath } = await ttsService.generatePodcastAudio(script)

      // Broadcast the audio path for the renderer to play
      broadcastToWindows('voice:response-audio', {
        sessionId,
        audioPath,
      })
    } catch (ttsErr) {
      console.warn('[Voice] TTS failed:', ttsErr)
      // Text response already sent, audio is optional
    }
  } catch (err) {
    console.error('[Voice] Processing failed:', err)
    broadcastToWindows('voice:response-text', {
      sessionId,
      text: `Error: ${err instanceof Error ? err.message : 'Voice processing failed'}`,
    })
  }
}

/**
 * Stop a voice session.
 */
export function stopVoiceSession(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (session) {
    session.active = false
    sessions.delete(sessionId)
  }
}
