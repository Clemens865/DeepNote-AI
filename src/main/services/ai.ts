import { GoogleGenAI } from '@google/genai'
import { configService } from './config'
import type { SlideContentPlan } from '../../shared/types'

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  const apiKey = configService.getApiKey()
  if (!apiKey) throw new Error('Gemini API key not configured. Please set it in Settings.')
  if (!client) {
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

export function resetAiClient(): void {
  client = null
}

function buildSystemPrompt(
  context: string,
  notebook?: { description?: string; responseLength?: string }
): string {
  let systemPrompt = `You are a helpful AI assistant analyzing the user's sources in a notebook application.`
  if (notebook?.description) {
    systemPrompt += `\nNotebook description: ${notebook.description}`
  }
  if (context) {
    systemPrompt += `\n\nUse the following source material to answer questions. Always cite your sources when referencing specific information using [Source N] notation.\n\n${context}`
  }
  const lengthHint =
    notebook?.responseLength === 'short'
      ? 'Keep your response concise (2-3 paragraphs max).'
      : notebook?.responseLength === 'long'
        ? 'Provide a detailed, comprehensive response.'
        : 'Provide a moderately detailed response.'
  systemPrompt += `\n\n${lengthHint}`
  return systemPrompt
}

export class AiService {
  async chat(
    messages: { role: string; content: string }[],
    context: string,
    notebook?: { description?: string; responseLength?: string }
  ): Promise<string> {
    const ai = getClient()
    const systemPrompt = buildSystemPrompt(context, notebook)

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }))

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      config: { systemInstruction: systemPrompt },
      contents,
    })

    return response.text ?? 'No response generated.'
  }

  async chatStream(
    messages: { role: string; content: string }[],
    context: string,
    notebook?: { description?: string; responseLength?: string },
    onChunk?: (text: string) => void
  ): Promise<string> {
    const ai = getClient()
    const systemPrompt = buildSystemPrompt(context, notebook)

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }))

    const response = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash',
      config: { systemInstruction: systemPrompt },
      contents,
    })

    let fullText = ''
    for await (const chunk of response) {
      const text = chunk.text ?? ''
      if (text) {
        fullText += text
        onChunk?.(text)
      }
    }

    return fullText || 'No response generated.'
  }

  async generateSourceGuide(text: string): Promise<string> {
    const ai = getClient()
    const truncated = text.slice(0, 30000)

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Summarize the following document in 3-4 sentences. Focus on what this source is about, the key topics covered, and why it might be useful for study or research.\n\nDocument:\n${truncated}`,
            },
          ],
        },
      ],
    })

    return response.text ?? 'Summary unavailable.'
  }

  async generateContent(
    type: string,
    sourceTexts: string[],
    options?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const ai = getClient()
    const combinedText = sourceTexts.join('\n\n---\n\n').slice(0, 100000)
    const userDescription = options?.description ? `\nUser instructions: ${options.description}` : ''

    let prompt = ''
    switch (type) {
      case 'report':
        prompt = `You are analyzing the following source material. Generate a comprehensive report.${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "summary": "A 2-3 sentence overview",
  "sections": [
    { "title": "Section Title", "content": "Section content with key findings..." }
  ]
}

Include 3-6 sections covering the main topics. Provide detailed analysis in each section. Output ONLY valid JSON, no markdown fences.`
        break

      case 'quiz': {
        const qCount = options?.questionCount === 'fewer' ? '3-5' : options?.questionCount === 'more' ? '12-20' : '5-10'
        const qDifficulty = options?.difficulty === 'easy' ? 'Keep the questions simple and straightforward, testing basic recall.' : options?.difficulty === 'hard' ? 'Make the questions challenging, requiring deep understanding, analysis, and inference.' : ''
        prompt = `You are creating a quiz from the following source material.${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "questions": [
    {
      "question": "The question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct..."
    }
  ]
}

Generate ${qCount} multiple choice questions that test understanding of the material. ${qDifficulty} Output ONLY valid JSON, no markdown fences.`
        break
      }

      case 'flashcard': {
        const cCount = options?.cardCount === 'fewer' ? '5-8' : options?.cardCount === 'more' ? '25-35' : '10-20'
        const cDifficulty = options?.difficulty === 'easy' ? 'Focus on basic definitions and key facts.' : options?.difficulty === 'hard' ? 'Focus on complex concepts, relationships, and nuanced details that require deep understanding.' : ''
        prompt = `You are creating study flashcards from the following source material.${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "cards": [
    {
      "front": "Question or concept",
      "back": "Answer or explanation",
      "sourceRef": "Brief reference to source"
    }
  ]
}

Generate ${cCount} flashcards covering key concepts, terms, and facts. ${cDifficulty} Output ONLY valid JSON, no markdown fences.`
        break
      }

      case 'mindmap':
        prompt = `You are creating a mind map from the following source material. Identify the central topic and main branches of ideas.${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "Central Topic",
  "branches": [
    {
      "label": "Main Branch",
      "children": [
        { "label": "Sub-topic", "children": [] }
      ]
    }
  ]
}

Create 3-6 main branches with 2-4 children each. Go up to 3 levels deep where appropriate. Output ONLY valid JSON, no markdown fences.`
        break

      case 'datatable':
        prompt = `You are creating a structured data table from the following source material. Extract the most important facts, comparisons, or data points into a tabular format.${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "Table Title",
  "columns": ["Column 1", "Column 2", "Column 3"],
  "rows": [
    ["Cell 1", "Cell 2", "Cell 3"]
  ]
}

Include 5-15 rows of meaningful data extracted from the sources. Choose columns that best organize the information. Output ONLY valid JSON, no markdown fences.`
        break

      case 'slides':
        prompt = `You are creating a slide deck presentation from the following source material.${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "Presentation Title",
  "slides": [
    {
      "title": "Slide Title",
      "bullets": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
      "notes": "Speaker notes for this slide"
    }
  ]
}

Create 6-12 slides covering the key topics. Each slide should have 3-5 bullet points and brief speaker notes. Output ONLY valid JSON, no markdown fences.`
        break

      default:
        throw new Error(`Unsupported content type: ${type}`)
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const responseText = response.text ?? '{}'

    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    try {
      return JSON.parse(cleaned)
    } catch {
      return { raw: responseText }
    }
  }

  async generatePodcastScript(
    sourceTexts: string[],
    options?: Record<string, unknown>
  ): Promise<{ speakers: { name: string; voice: string }[]; turns: { speaker: string; text: string }[] }> {
    const ai = getClient()
    const combinedText = sourceTexts.join('\n\n---\n\n').slice(0, 100000)

    const audioFormat = (options?.audioFormat as string) || 'deep-dive'
    const audioLength = (options?.length as string) || 'default'
    const focusText = options?.description ? `\nFocus area: ${options.description}` : ''

    const formatDirective =
      audioFormat === 'brief'
        ? 'FORMAT: Brief Overview — a short, punchy summary conversation. Keep it tight and focused on the most important points.'
        : audioFormat === 'critique'
          ? 'FORMAT: Critical Analysis — the hosts analyze and debate the strengths and weaknesses of the material. Include balanced criticism and praise.'
          : audioFormat === 'debate'
            ? 'FORMAT: Debate — the two hosts take opposing perspectives on the material, engaging in respectful intellectual debate. One host defends the ideas, the other challenges them.'
            : 'FORMAT: Deep Dive — a thorough, comprehensive discussion exploring every major topic in depth.'

    const turnCount =
      audioLength === 'short' ? '8-12' : audioLength === 'long' ? '30-45' : '15-25'

    const prompt = `You are creating a conversational podcast script from the following source material. Two hosts discuss the material in an engaging, educational way.

${formatDirective}${focusText}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "speakers": [
    { "name": "Host A", "voice": "Kore" },
    { "name": "Host B", "voice": "Puck" }
  ],
  "turns": [
    { "speaker": "Host A", "text": "Welcome to today's deep dive..." },
    { "speaker": "Host B", "text": "Thanks! I'm really excited about this topic..." }
  ]
}

Rules:
- Host A is the lead host (firm, knowledgeable tone)
- Host B is the co-host (upbeat, curious, asks clarifying questions)
- Generate ${turnCount} conversational turns
- Make it natural and engaging, not a lecture
- Cover the key points from the source material
- Include an introduction and a brief wrap-up

Output ONLY valid JSON, no markdown fences.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const responseText = response.text ?? '{}'
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      return JSON.parse(cleaned)
    } catch {
      throw new Error('Failed to parse podcast script from AI response')
    }
  }

  async planImageSlides(
    sourceTexts: string[],
    slideCount: number,
    format: 'presentation' | 'pitch' | 'report' = 'presentation',
    userInstructions?: string
  ): Promise<SlideContentPlan[]> {
    const ai = getClient()
    const combinedText = sourceTexts.join('\n\n---\n\n').slice(0, 80000)

    const formatDirectives: Record<string, string> = {
      presentation: `FORMAT: Presentation — educational/informational deck. Each slide should be self-contained and understandable without a presenter. Start with a title slide, end with key takeaways. Flow: introduce topic → explain concepts → summarize.`,
      pitch: `FORMAT: Pitch Deck — persuasive business pitch. Flow MUST be: Title → Problem → Solution → How It Works → Market Opportunity → Traction/Progress → Business Model → Team → The Ask/CTA. Each slide: bold headline + 2-3 punchy stats or points.`,
      report: `FORMAT: Report Deck — data-driven analytical report. Include specific numbers, comparisons, and evidence. Flow: Executive Summary → Key Findings → Analysis sections → Conclusions → Recommendations.`,
    }

    const formatDirective = formatDirectives[format] || formatDirectives.presentation

    const userDirective = userInstructions
      ? `\nUSER INSTRUCTIONS: ${userInstructions}`
      : ''

    const prompt = `You are a professional presentation designer planning a ${slideCount}-slide deck based on the source material.
Target Audience: General Professional/Educational.

SOURCE MATERIAL:
${combinedText}

${formatDirective}${userDirective}

CRITICAL RULES:
1.  **Slide Count**: You MUST output EXACTLY ${slideCount} slides. Not ${slideCount - 1}, not ${slideCount + 1}. Exactly ${slideCount}.
2.  **Self-Explanatory**: Each slide must make sense on its own. Bullets should be complete, informative phrases — not cryptic fragments. A reader should understand the point without a presenter explaining it.
3.  **Concise But Clear**: Titles: 2-6 words. Bullets: one clear sentence or phrase each (max ~12 words). Max 4 bullets per slide. Avoid walls of text, but don't strip away meaning.
4.  **Visuals**: For each slide, describe a specific illustration/visual concept in visualCue. Be concrete (e.g., "3D bar chart with glowing cyan bars comparing three metrics" not "a chart"). The visual should complement and reinforce the slide's message.
5.  **Content Field**: The content field is what gets rendered as text ON the slide image. Include title + bullets using \\n for line breaks. This must contain enough information to be self-explanatory.

Output a JSON array with EXACTLY ${slideCount} objects (ONLY valid JSON, no markdown fences):
[
  {
    "slideNumber": 1,
    "layout": "Title",
    "title": "Machine Learning",
    "bullets": ["Systems that learn and improve from data", "Three core approaches shape the field"],
    "visualCue": "A futuristic digital brain with neural network connections glowing, abstract data particles flowing around it.",
    "content": "Machine Learning\\n\\nSystems that learn and improve from data\\nThree core approaches shape the field",
    "speakerNotes": "Welcome. Today we explore Machine Learning — the subset of AI that enables systems to learn from data. We will cover supervised, unsupervised, and reinforcement learning."
  }
]

Remember: output EXACTLY ${slideCount} slide objects in the array.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const responseText = response.text ?? '[]'
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const plans = JSON.parse(cleaned)
      if (!Array.isArray(plans)) throw new Error('Expected array')
      return plans
    } catch {
      throw new Error('Failed to parse slide content plan from AI response')
    }
  }

  async describeImageStyle(imagePath: string): Promise<string> {
    const ai = getClient()
    const { readFileSync } = await import('fs')
    const imageBuffer = readFileSync(imagePath)
    const base64 = imageBuffer.toString('base64')

    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: { data: base64, mimeType },
            },
            {
              text: 'Describe the visual style of this image in detail for use as a prompt suffix for AI image generation. Focus on: color palette, typography style, background treatment, shape language, overall mood/aesthetic. Output only the style description, no preamble.',
            },
          ],
        },
      ],
    })

    return response.text ?? ''
  }

  async deepResearch(
    query: string,
    sourceTexts: string[],
    onProgress?: (status: string, thinking?: string) => void
  ): Promise<string> {
    const ai = getClient()
    const context = sourceTexts.join('\n\n---\n\n').slice(0, 50000)

    const researchPrompt = `You are a thorough research assistant. The user has asked you to do deep research on the following query, using the provided source materials as your foundation.

SOURCE MATERIALS:
${context}

RESEARCH QUERY: ${query}

Please provide a comprehensive, well-structured research report that:
1. Thoroughly analyzes the query using the source materials
2. Identifies key themes, patterns, and connections
3. Provides detailed findings with evidence from the sources
4. Notes any gaps in the available information
5. Offers conclusions and potential areas for further research

Structure your response with clear headings and sections. Be thorough and detailed.`

    onProgress?.('researching', 'Analyzing sources and generating research report...')

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
    })

    onProgress?.('finalizing', 'Finalizing research report...')

    return response.text ?? 'No research results generated.'
  }
}

export const aiService = new AiService()
