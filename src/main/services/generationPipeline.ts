import { GoogleGenAI } from '@google/genai'
import { configService } from './config'
import { generateWithValidation } from './aiMiddleware'

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  const apiKey = configService.getApiKey()
  if (!apiKey) throw new Error('Gemini API key not configured.')
  if (!client) client = new GoogleGenAI({ apiKey })
  return client
}

export function resetPipelineClient(): void {
  client = null
}

// --- Types ---

export interface PipelineContext {
  type: string
  sourceTexts: string[]
  options?: Record<string, unknown>
  combinedText: string
  researchFindings?: string
  generatedContent?: Record<string, unknown>
  reviewFeedback?: string
  reviewScore?: number
}

export type PipelineProgressCallback = (stage: 'researching' | 'writing' | 'reviewing' | 'revising') => void

// Types that benefit from the multi-agent pipeline
const PIPELINE_TYPES = new Set([
  'report',
  'literature-review',
  'competitive-analysis',
  'dashboard',
  'whitepaper',
])

export function shouldUsePipeline(type: string): boolean {
  return PIPELINE_TYPES.has(type)
}

// --- Pipeline Stages ---

/**
 * Stage 1: Research — AI analyzes sources to extract key themes, facts, data points.
 */
async function research(ctx: PipelineContext): Promise<string> {
  const ai = getClient()

  const prompt = `You are a research analyst. Analyze the following source material and extract a structured research brief that will be used to generate a ${ctx.type}.

Source material:
${ctx.combinedText.slice(0, 80000)}

Output a research brief with:
1. KEY THEMES: Major themes and topics found across sources
2. KEY FACTS & DATA: Important statistics, numbers, dates, and factual claims
3. KEY ENTITIES: People, organizations, products, or concepts mentioned
4. RELATIONSHIPS: How different topics/entities relate to each other
5. GAPS: What information seems missing or incomplete
6. RECOMMENDED STRUCTURE: Suggest how to organize a ${ctx.type} based on this material

Be thorough but concise. Focus on information that's most relevant for creating a high-quality ${ctx.type}.`

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })

  return response.text ?? ''
}

/**
 * Stage 2: Write — Generate content using research findings + source material.
 */
async function write(
  ctx: PipelineContext,
  originalPrompt: string
): Promise<Record<string, unknown>> {
  // Enhance the original prompt with research findings
  const enhancedPrompt = `${originalPrompt}

RESEARCH BRIEF (use this to inform your output — it summarizes key themes, facts, and structure recommendations):
${ctx.researchFindings?.slice(0, 20000) ?? ''}

${ctx.reviewFeedback ? `\nPREVIOUS REVIEW FEEDBACK (address these issues):\n${ctx.reviewFeedback}` : ''}`

  return generateWithValidation(ctx.type, enhancedPrompt, ctx.sourceTexts, ctx.options)
}

/**
 * Stage 3: Review — AI validates quality and completeness.
 */
async function review(
  ctx: PipelineContext
): Promise<{ score: number; feedback: string }> {
  const ai = getClient()
  const contentStr = JSON.stringify(ctx.generatedContent, null, 2).slice(0, 30000)

  const prompt = `You are a quality reviewer. Review the following generated ${ctx.type} content for quality, completeness, and accuracy.

Generated content:
${contentStr}

Research brief that was used:
${ctx.researchFindings?.slice(0, 10000) ?? 'Not available'}

Score the content from 1-10 on:
- Completeness: Does it cover the key themes from the research?
- Accuracy: Is the data/information correctly represented?
- Structure: Is it well-organized and logical?
- Quality: Is the writing/formatting professional?

Output a JSON object:
{
  "overallScore": 7,
  "feedback": "Specific actionable feedback on what to improve",
  "strengths": ["What's done well"],
  "weaknesses": ["What needs improvement"]
}

Output ONLY valid JSON, no markdown fences.`

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })

  const raw = (response.text ?? '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    const result = JSON.parse(raw)
    return {
      score: result.overallScore ?? 5,
      feedback: result.feedback ?? '',
    }
  } catch {
    return { score: 7, feedback: '' }
  }
}

// --- Main Pipeline Executor ---

/**
 * Execute the full Research → Write → Review pipeline.
 * If review score < 6, feeds back to write stage (1 retry).
 */
export async function executePipeline(
  type: string,
  originalPrompt: string,
  sourceTexts: string[],
  options?: Record<string, unknown>,
  onProgress?: PipelineProgressCallback
): Promise<Record<string, unknown>> {
  const combinedText = sourceTexts.join('\n\n---\n\n').slice(0, 100000)

  const ctx: PipelineContext = {
    type,
    sourceTexts,
    options,
    combinedText,
  }

  // Stage 1: Research
  onProgress?.('researching')
  try {
    ctx.researchFindings = await research(ctx)
    console.log('[Pipeline] Research complete:', ctx.researchFindings.length, 'chars')
  } catch (err) {
    console.warn('[Pipeline] Research failed, continuing without:', err)
    ctx.researchFindings = ''
  }

  // Stage 2: Write
  onProgress?.('writing')
  ctx.generatedContent = await write(ctx, originalPrompt)
  console.log('[Pipeline] First draft complete')

  // Stage 3: Review
  onProgress?.('reviewing')
  let reviewResult: { score: number; feedback: string }
  try {
    reviewResult = await review(ctx)
    console.log('[Pipeline] Review score:', reviewResult.score)
  } catch (err) {
    console.warn('[Pipeline] Review failed, using first draft:', err)
    return ctx.generatedContent
  }

  // If score is low, do one revision
  if (reviewResult.score < 6 && reviewResult.feedback) {
    onProgress?.('revising')
    ctx.reviewFeedback = reviewResult.feedback
    console.log('[Pipeline] Revising based on feedback:', reviewResult.feedback.slice(0, 200))

    try {
      ctx.generatedContent = await write(ctx, originalPrompt)
      console.log('[Pipeline] Revision complete')
    } catch (err) {
      console.warn('[Pipeline] Revision failed, using first draft:', err)
    }
  }

  return ctx.generatedContent!
}
