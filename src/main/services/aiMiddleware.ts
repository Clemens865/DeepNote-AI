import { GoogleGenAI } from '@google/genai'
import { configService } from './config'

// --- Types ---

export interface AiMiddlewareContext {
  type: string
  prompt: string
  sourceTexts: string[]
  options?: Record<string, unknown>
  attempt: number
  lastError?: string
}

export interface AiMiddleware {
  name: string
  before?(ctx: AiMiddlewareContext): AiMiddlewareContext | Promise<AiMiddlewareContext>
  after?(ctx: AiMiddlewareContext, raw: string): string | Promise<string>
}

// --- Pipeline ---

export class AiMiddlewarePipeline {
  private middlewares: AiMiddleware[] = []

  use(mw: AiMiddleware): this {
    this.middlewares.push(mw)
    return this
  }

  async runBefore(ctx: AiMiddlewareContext): Promise<AiMiddlewareContext> {
    let current = ctx
    for (const mw of this.middlewares) {
      if (mw.before) current = await mw.before(current)
    }
    return current
  }

  async runAfter(ctx: AiMiddlewareContext, raw: string): Promise<string> {
    let current = raw
    for (const mw of this.middlewares) {
      if (mw.after) current = await mw.after(ctx, current)
    }
    return current
  }
}

// --- Built-in Middlewares ---

/**
 * Strips markdown fences, validates JSON, retries on parse failure.
 */
export const jsonValidationMiddleware: AiMiddleware = {
  name: 'json-validation',
  after(_ctx, raw) {
    const cleaned = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    // Validate that it's parseable JSON
    JSON.parse(cleaned)
    return cleaned
  },
}

/**
 * Per-type structure checks — ensures required fields exist.
 */
export const structureValidationMiddleware: AiMiddleware = {
  name: 'structure-validation',
  after(ctx, raw) {
    const parsed = JSON.parse(raw)

    switch (ctx.type) {
      case 'quiz':
        if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
          throw new Error('Quiz must contain a non-empty "questions" array')
        }
        for (const q of parsed.questions) {
          if (!q.question || !Array.isArray(q.options) || typeof q.correctIndex !== 'number') {
            throw new Error('Each quiz question must have question, options[], and correctIndex')
          }
        }
        break

      case 'flashcard':
        if (!parsed.cards || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
          throw new Error('Flashcards must contain a non-empty "cards" array')
        }
        for (const c of parsed.cards) {
          if (!c.front || !c.back) {
            throw new Error('Each flashcard must have front and back')
          }
        }
        break

      case 'mindmap':
        if (!parsed.title || !Array.isArray(parsed.branches)) {
          throw new Error('Mind map must have title and branches[]')
        }
        break

      case 'datatable':
        if (!Array.isArray(parsed.columns) || !Array.isArray(parsed.rows)) {
          throw new Error('Data table must have columns[] and rows[]')
        }
        break

      case 'report':
        if (!parsed.markdown && !parsed.summary) {
          throw new Error('Report must have markdown or summary')
        }
        break

      case 'dashboard':
        if (!Array.isArray(parsed.kpis)) {
          throw new Error('Dashboard must have kpis[]')
        }
        break

      case 'slides':
        if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
          throw new Error('Slides must contain a non-empty "slides" array')
        }
        break

      case 'literature-review':
        if (!Array.isArray(parsed.themes)) {
          throw new Error('Literature review must have themes[]')
        }
        break

      case 'competitive-analysis':
        if (!Array.isArray(parsed.competitors) || !Array.isArray(parsed.features)) {
          throw new Error('Competitive analysis must have competitors[] and features[]')
        }
        break

      case 'diff':
        if (!Array.isArray(parsed.sections)) {
          throw new Error('Document comparison must have sections[]')
        }
        break

      case 'citation-graph':
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          throw new Error('Citation graph must have nodes[] and edges[]')
        }
        break
    }

    return raw
  },
}

// --- Validated Generation ---

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  const apiKey = configService.getApiKey()
  if (!apiKey) throw new Error('Gemini API key not configured.')
  if (!client) client = new GoogleGenAI({ apiKey })
  return client
}

export function resetMiddlewareClient(): void {
  client = null
}

const pipeline = new AiMiddlewarePipeline()
  .use(jsonValidationMiddleware)
  .use(structureValidationMiddleware)

/**
 * Generate content with validation + retry.
 * On parse/validation failure, appends the error to the prompt and retries (up to 3 attempts).
 */
export async function generateWithValidation(
  type: string,
  prompt: string,
  sourceTexts: string[],
  options?: Record<string, unknown>,
  maxRetries = 3
): Promise<Record<string, unknown>> {
  const ai = getClient()
  let lastError = ''

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const ctx: AiMiddlewareContext = {
      type,
      prompt,
      sourceTexts,
      options,
      attempt,
      lastError: lastError || undefined,
    }

    const processed = await pipeline.runBefore(ctx)

    // On retry, append error feedback to the prompt
    let finalPrompt = processed.prompt
    if (attempt > 0 && lastError) {
      finalPrompt += `\n\nYour previous response had this error: ${lastError}\nPlease fix the issue and output ONLY valid JSON.`
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
    })

    const raw = response.text ?? '{}'

    try {
      const validated = await pipeline.runAfter(ctx, raw)
      return JSON.parse(validated)
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Invalid JSON output'
      console.warn(`[AiMiddleware] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError}`)
      if (attempt === maxRetries - 1) {
        // Final attempt failed — return raw text as fallback
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        try {
          return JSON.parse(cleaned)
        } catch {
          return { raw }
        }
      }
    }
  }

  return { raw: '' }
}
