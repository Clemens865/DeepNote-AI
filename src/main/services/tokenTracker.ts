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
// Updated Mar 2026 from: ai.google.dev/gemini-api/docs/pricing

// Standard text pricing (per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  // Gemini 3.x
  'gemini-3-flash-preview':          { input: 0.50,  output: 3.00 },
  'gemini-3-pro-preview':            { input: 2.00,  output: 12.00 },
  'gemini-3.1-pro-preview':          { input: 2.00,  output: 12.00 },
  'gemini-3.1-flash-lite-preview':   { input: 0.25,  output: 1.50 },
  // Gemini 2.5
  'gemini-2.5-flash':                { input: 0.30,  output: 2.50 },
  'gemini-2.5-flash-lite':           { input: 0.10,  output: 0.40 },
  'gemini-2.5-pro':                  { input: 1.25,  output: 10.00 },
  // Gemini 2.0
  'gemini-2.0-flash':                { input: 0.10,  output: 0.40 },
  'gemini-2.0-flash-lite':           { input: 0.075, output: 0.30 },
  // Claude 4.6 / 4.5
  'claude-opus-4-6':                 { input: 5.00,  output: 25.00 },
  'claude-sonnet-4-6':               { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':                { input: 1.00,  output: 5.00 },
  // OpenAI
  'gpt-4o':                          { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':                     { input: 0.15,  output: 0.60 },
  // Groq
  'llama-3.3-70b-versatile':         { input: 0.59,  output: 0.79 },
  'mixtral-8x7b-32768':              { input: 0.24,  output: 0.24 },
  // TTS models
  'gemini-2.5-flash-preview-tts':    { input: 0.50,  output: 10.00 },
  'gemini-2.5-pro-preview-tts':      { input: 1.00,  output: 20.00 },
  // Embedding models
  'gemini-embedding-2-preview':      { input: 0.20,  output: 0.00 },
  'gemini-embedding-001':            { input: 0.15,  output: 0.00 },
}

// Gemini image generation models have DIFFERENT output pricing for images vs text.
// The output token cost for generated images is dramatically higher than text.
// Pricing per 1M tokens (USD) — image output rate (not text output rate!)
const IMAGE_MODEL_PRICING: Record<string, { input: number; imageOutput: number; textOutput: number }> = {
  // $120/1M output tokens for images, $12/1M for text/thinking
  'gemini-3-pro-image-preview':      { input: 2.00, imageOutput: 120.00, textOutput: 12.00 },
  // $60/1M output tokens for images, $3/1M for text/thinking
  'gemini-3.1-flash-image-preview':  { input: 0.50, imageOutput: 60.00, textOutput: 3.00 },
  // ~$0.039 per image (1290 tokens at 1024x1024)
  'gemini-2.5-flash-image':          { input: 0.30, imageOutput: 30.23, textOutput: 2.50 },
}

// Fallback pricing by provider for unknown models
const PROVIDER_FALLBACK: Record<string, { input: number; output: number }> = {
  gemini: { input: 0.50, output: 3.00 },
  claude: { input: 3.00, output: 15.00 },
  openai: { input: 2.50, output: 10.00 },
  groq: { input: 0.59, output: 0.79 },
}

// Veo video pricing (per second of output video, USD)
const VEO_PRICING: Record<string, { standard: number; fourK: number }> = {
  'veo-3.1-generate-preview':       { standard: 0.40, fourK: 0.60 },
  'veo-3.1-fast-generate-preview':  { standard: 0.15, fourK: 0.35 },
  'veo-3.0-generate-001':           { standard: 0.40, fourK: 0.40 },
  'veo-3-generate':                 { standard: 0.40, fourK: 0.40 },
  'veo-3.0-fast-generate-001':      { standard: 0.15, fourK: 0.15 },
  'veo-3-fast-generate':            { standard: 0.15, fourK: 0.15 },
  'veo-2.0-generate-001':           { standard: 0.35, fourK: 0.35 },
  'veo-2-generate':                 { standard: 0.35, fourK: 0.35 },
}

// Imagen 4 pricing (per image, USD)
const IMAGEN_PRICING: Record<string, number> = {
  'imagen-4.0-fast-generate-001':  0.02,
  'imagen-4.0-generate-001':       0.04,
  'imagen-4.0-ultra-generate-001': 0.06,
}

function estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] || PROVIDER_FALLBACK[provider] || { input: 0.10, output: 0.40 }
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

/** Estimate cost for image generation models (higher output rate for images) */
function estimateImageGenCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = IMAGE_MODEL_PRICING[model]
  if (pricing) {
    // Output tokens from image generation are charged at the image rate
    return (inputTokens * pricing.input + outputTokens * pricing.imageOutput) / 1_000_000
  }
  // Fall back to standard pricing
  return estimateCost('gemini', model, inputTokens, outputTokens)
}

function estimateVeoCost(model: string, durationSec: number, resolution: string): number {
  const pricing = VEO_PRICING[model] || { standard: 0.40, fourK: 0.60 }
  const rate = resolution === '4k' ? pricing.fourK : pricing.standard
  return durationSec * rate
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

  /**
   * Track image generation with the correct (higher) output token pricing.
   */
  trackImageGen(
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
      provider: 'gemini',
      model,
      feature,
      inputTokens,
      outputTokens,
      estimatedCost: estimateImageGenCost(model, inputTokens, outputTokens),
    }
    this.entries.push(entry)
    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(-1000)
    }
    this.scheduleSave()
  }

  /**
   * Track a fixed-cost API call (video generation, Imagen, etc.).
   */
  trackFixedCost(
    provider: 'gemini' | 'claude' | 'openai' | 'groq',
    model: string,
    feature: string,
    cost: number
  ): void {
    if (cost <= 0) return
    this.ensurePath()
    const entry: TokenLogEntry = {
      id: `t-${Date.now()}-${++this.idCounter}`,
      timestamp: new Date().toISOString(),
      provider,
      model,
      feature,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: cost,
    }
    this.entries.push(entry)
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

// --- Video / Image Helpers ---

/**
 * Track Veo video generation cost based on model, duration, and resolution.
 */
export function trackVeoCost(model: string, durationSec: number, resolution: string, feature: string): void {
  const cost = estimateVeoCost(model, durationSec, resolution)
  tokenTracker.trackFixedCost('gemini', model, feature, cost)
}

/**
 * Track Imagen 4 image generation cost (per-image pricing).
 */
export function trackImagenCost(model: string, imageCount: number, feature: string): void {
  const pricePerImage = IMAGEN_PRICING[model] || 0.04
  tokenTracker.trackFixedCost('gemini', model, feature, pricePerImage * imageCount)
}

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

/**
 * Track token usage from a Gemini image generation response.
 * Uses the higher image output token pricing.
 */
export function trackGeminiImageResponse(
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
      tokenTracker.trackImageGen(model, feature, input, output)
    }
  } catch {
    // Never let tracking break the app
  }
}
