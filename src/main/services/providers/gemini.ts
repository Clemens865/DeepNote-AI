import { GoogleGenAI } from '@google/genai'
import type { ChatProviderAdapter } from './types'
import { trackGeminiResponse } from '../tokenTracker'

export class GeminiAdapter implements ChatProviderAdapter {
  private client: GoogleGenAI
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenAI({ apiKey })
    this.model = model
  }

  async chatStream(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    onChunk: (text: string) => void
  ): Promise<string> {
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }))

    const response = await this.client.models.generateContentStream({
      model: this.model,
      config: { systemInstruction: systemPrompt },
      contents,
    })

    let fullText = ''
    let lastChunk: unknown
    for await (const chunk of response) {
      lastChunk = chunk
      const text = chunk.text ?? ''
      if (text) {
        fullText += text
        onChunk(text)
      }
    }
    if (lastChunk) trackGeminiResponse(lastChunk, this.model, 'provider:gemini-chat')

    return fullText || 'No response generated.'
  }
}
