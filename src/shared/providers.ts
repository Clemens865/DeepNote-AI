export type ChatProviderType = 'gemini' | 'claude' | 'openai' | 'groq'

export interface ModelOption {
  id: string
  name: string
  isDefault?: boolean
}

export interface ProviderDef {
  id: ChatProviderType
  name: string
  models: ModelOption[]
  keyPlaceholder: string
  keyUrl: string
}

export const CHAT_PROVIDERS: ProviderDef[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', isDefault: true },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ],
    keyPlaceholder: 'Gemini API key...',
    keyUrl: 'aistudio.google.com',
  },
  {
    id: 'claude',
    name: 'Claude',
    models: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet', isDefault: true },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku' },
    ],
    keyPlaceholder: 'Anthropic API key (sk-ant-...)...',
    keyUrl: 'console.anthropic.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', isDefault: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
    keyPlaceholder: 'OpenAI API key (sk-...)...',
    keyUrl: 'platform.openai.com',
  },
  {
    id: 'groq',
    name: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', isDefault: true },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    ],
    keyPlaceholder: 'Groq API key (gsk_...)...',
    keyUrl: 'console.groq.com',
  },
]
