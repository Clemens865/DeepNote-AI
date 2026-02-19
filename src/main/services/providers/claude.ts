import Anthropic from '@anthropic-ai/sdk'
import type { ChatProviderAdapter } from './types'

export class ClaudeAdapter implements ChatProviderAdapter {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async chatStream(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    onChunk: (text: string) => void
  ): Promise<string> {
    const formattedMessages = messages.map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    }))

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: formattedMessages,
    })

    let fullText = ''
    stream.on('text', (text) => {
      fullText += text
      onChunk(text)
    })

    await stream.finalMessage()

    return fullText || 'No response generated.'
  }
}
