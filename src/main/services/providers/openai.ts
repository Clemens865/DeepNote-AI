import OpenAI from 'openai'
import type { ChatProviderAdapter } from './types'
import { tokenTracker } from '../tokenTracker'

export class OpenAIAdapter implements ChatProviderAdapter {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey })
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
      stream_options: { include_usage: true },
    })

    let fullText = ''
    let usageData: { prompt_tokens?: number; completion_tokens?: number } | null = null
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? ''
      if (text) {
        fullText += text
        onChunk(text)
      }
      if (chunk.usage) {
        usageData = chunk.usage
      }
    }
    if (usageData) {
      tokenTracker.track('openai', this.model, 'provider:openai-chat', usageData.prompt_tokens ?? 0, usageData.completion_tokens ?? 0)
    }

    return fullText || 'No response generated.'
  }
}
