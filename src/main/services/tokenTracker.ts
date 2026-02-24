import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

// --- Types ---

export interface TokenLogEntry {
  id: string
  timestamp: string
  provider: 'gemini' | 'claude' | 'openai' | 'groq'
  model: string
  feature: string
  inputTokens: number
  outputTokens: number
  estimatedCost: number
}

export interface TokenUsageSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalEstimatedCost: number
  byProvider: Record<string, { input: number; output: number; cost: number; calls: number }>
  recentCalls: TokenLogEntry[]
}

// --- Pricing (per 1M tokens, USD) ---

// Pricing per 1M tokens (USD) — researched Feb 2026
// Sources:
//   Gemini:  ai.google.dev/gemini-api/docs/pricing, pricepertoken.com
//   Claude:  platform.claude.com/docs/en/about-claude/pricing
//   OpenAI:  openai.com/api/pricing
//   Groq:    groq.com/pricing, helicone.ai
const PRICING: Record<string, { input: number; output: number }> = {
  // Gemini 3.x
  'gemini-3-flash-preview':     { input: 0.50,  output: 3.00 },
  'gemini-3-pro-preview':       { input: 2.00,  output: 12.00 },
  'gemini-3.1-pro-preview':     { input: 2.00,  output: 12.00 },
  'gemini-3-pro-image-preview': { input: 2.00,  output: 12.00 },
  // Gemini 2.5
  'gemini-2.5-flash':           { input: 0.30,  output: 2.50 },
  'gemini-2.5-pro':             { input: 1.25,  output: 10.00 },
  // Claude 4.6 / 4.5
  'claude-opus-4-6':            { input: 5.00,  output: 25.00 },
  'claude-sonnet-4-6':          { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':           { input: 1.00,  output: 5.00 },
  // OpenAI
  'gpt-4o':                     { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':                { input: 0.15,  output: 0.60 },
  // Groq
  'llama-3.3-70b-versatile':    { input: 0.59,  output: 0.79 },
  'mixtral-8x7b-32768':         { input: 0.24,  output: 0.24 },
}

// Fallback pricing by provider for unknown models
const PROVIDER_FALLBACK: Record<string, { input: number; output: number }> = {
  gemini: { input: 0.50, output: 3.00 },
  claude: { input: 3.00, output: 15.00 },
  openai: { input: 2.50, output: 10.00 },
  groq: { input: 0.59, output: 0.79 },
}

function estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] || PROVIDER_FALLBACK[provider] || { input: 0.10, output: 0.40 }
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

// --- TokenTracker ---

class TokenTracker {
  private entries: TokenLogEntry[] = []
  private filePath: string = ''
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private idCounter = 0

  constructor() {
    try {
      this.filePath = join(app.getPath('userData'), 'token-usage.json')
      this.load()
    } catch {
      // app.getPath may fail if called before app is ready
    }
  }

  private ensurePath(): void {
    if (!this.filePath) {
      this.filePath = join(app.getPath('userData'), 'token-usage.json')
      this.load()
    }
  }

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'))
        this.entries = Array.isArray(data.entries) ? data.entries : []
      }
    } catch {
      this.entries = []
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.saveToDisk()
    }, 2000)
  }

  private saveToDisk(): void {
    try {
      this.ensurePath()
      writeFileSync(this.filePath, JSON.stringify({ entries: this.entries }, null, 2))
    } catch {
      // Non-critical — ignore save failures
    }
  }

  track(
    provider: 'gemini' | 'claude' | 'openai' | 'groq',
    model: string,
    feature: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    if (inputTokens <= 0 && outputTokens <= 0) return

    this.ensurePath()
    const entry: TokenLogEntry = {
      id: `t-${Date.now()}-${++this.idCounter}`,
      timestamp: new Date().toISOString(),
      provider,
      model,
      feature,
      inputTokens,
      outputTokens,
      estimatedCost: estimateCost(provider, model, inputTokens, outputTokens),
    }
    this.entries.push(entry)

    // Keep only last 1000 entries in memory
    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(-1000)
    }

    this.scheduleSave()
  }

  getSummary(): TokenUsageSummary {
    this.ensurePath()
    let totalInput = 0
    let totalOutput = 0
    let totalCost = 0
    const byProvider: Record<string, { input: number; output: number; cost: number; calls: number }> = {}

    for (const entry of this.entries) {
      totalInput += entry.inputTokens
      totalOutput += entry.outputTokens
      totalCost += entry.estimatedCost

      if (!byProvider[entry.provider]) {
        byProvider[entry.provider] = { input: 0, output: 0, cost: 0, calls: 0 }
      }
      byProvider[entry.provider].input += entry.inputTokens
      byProvider[entry.provider].output += entry.outputTokens
      byProvider[entry.provider].cost += entry.estimatedCost
      byProvider[entry.provider].calls += 1
    }

    return {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalEstimatedCost: totalCost,
      byProvider,
      recentCalls: this.entries.slice(-100).reverse(),
    }
  }

  reset(): void {
    this.entries = []
    this.saveToDisk()
  }
}

export const tokenTracker = new TokenTracker()

// --- Gemini Helpers ---

/**
 * Track token usage from a Gemini generateContent() response or the last streaming chunk.
 * Safely extracts usageMetadata if present.
 */
export function trackGeminiResponse(
  response: unknown,
  model: string,
  feature: string
): void {
  try {
    const resp = response as Record<string, unknown> | null | undefined
    if (!resp) return
    const usage = resp.usageMetadata as Record<string, unknown> | undefined
    if (!usage) return
    const input = (typeof usage.promptTokenCount === 'number' ? usage.promptTokenCount : 0)
    const output = (typeof usage.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : 0)
    if (input > 0 || output > 0) {
      tokenTracker.track('gemini', model, feature, input, output)
    }
  } catch {
    // Never let tracking break the app
  }
}
