import OpenAI from 'openai'
import type { ChatProviderAdapter } from './types'

export class GroqAdapter implements ChatProviderAdapter {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
    this.model = model
  }

  async chatStream(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    onChunk: (text: string) => void
  ): Promise<string> {
    const formattedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: formattedMessages,
      stream: true,
    })

    let fullText = ''
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? ''
      if (text) {
        fullText += text
        onChunk(text)
      }
    }

    return fullText || 'No response generated.'
  }
}
