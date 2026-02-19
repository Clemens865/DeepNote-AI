import type { ChatProviderType } from '../../../shared/providers'
import type { ConfigService } from '../config'
import type { ChatProviderAdapter } from './types'
import { GeminiAdapter } from './gemini'
import { ClaudeAdapter } from './claude'
import { OpenAIAdapter } from './openai'
import { GroqAdapter } from './groq'

export function getChatProvider(
  providerType: ChatProviderType,
  model: string,
  configService: ConfigService
): ChatProviderAdapter {
  const config = configService.getAll()

  switch (providerType) {
    case 'gemini': {
      const key = config.apiKey
      if (!key) throw new Error('Gemini API key not configured. Please set it in Settings.')
      return new GeminiAdapter(key, model)
    }
    case 'claude': {
      const key = config.claudeApiKey
      if (!key) throw new Error('Claude API key not configured. Please set it in Settings.')
      return new ClaudeAdapter(key, model)
    }
    case 'openai': {
      const key = config.openaiApiKey
      if (!key) throw new Error('OpenAI API key not configured. Please set it in Settings.')
      return new OpenAIAdapter(key, model)
    }
    case 'groq': {
      const key = config.groqApiKey
      if (!key) throw new Error('Groq API key not configured. Please set it in Settings.')
      return new GroqAdapter(key, model)
    }
    default:
      throw new Error(`Unknown chat provider: ${providerType}`)
  }
}
