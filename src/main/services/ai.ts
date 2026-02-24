import { GoogleGenAI } from '@google/genai'
import { configService } from './config'
import { generateWithValidation, resetMiddlewareClient } from './aiMiddleware'
import { shouldUsePipeline, executePipeline } from './generationPipeline'
import { memoryService } from './memory'
import { trackGeminiResponse } from './tokenTracker'
import type { SlideContentPlan, ReportFormatSuggestion, WhitePaperReference } from '../../shared/types'

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
  resetMiddlewareClient()
}

export async function buildSystemPrompt(
  context: string,
  notebook?: { description?: string; responseLength?: string; hasSpreadsheetSources?: boolean },
  notebookId?: string,
  deepbrainEnabled?: boolean
): Promise<string> {
  const sbEnabled = deepbrainEnabled !== false
  let systemPrompt = sbEnabled
    ? `You are a helpful AI assistant in DeepNote AI, a notebook application integrated with DeepBrain — a system-wide cognitive engine.

CRITICAL: You have access to TWO data sources:
1. NOTEBOOK SOURCES — documents, PDFs, pastes uploaded to this notebook
2. SYSTEM-WIDE DATA (DeepBrain) — the user's emails, local files, clipboard history, cross-app memories, and OS-level activity tracking

NEVER say "I cannot access your emails" or "I don't have access to your files." Instead, check the system-wide data section below. If DeepBrain found matching data, USE IT. If DeepBrain is connected but found nothing, tell the user the specific content wasn't found in the indexed files. If DeepBrain is not running, tell the user to start DeepBrain to enable system-wide search.

INTERPRETING SYSTEM-WIDE DATA:
- "Activity history" = OS-level app-switch tracking with timestamps. These are FACTS about what apps/windows were open and when. Use these as the primary evidence for "what was I working on?" questions.
- "Current activity" = what the user is doing RIGHT NOW (frontmost app, window, project, recently opened files).
- "System files" = files whose CONTENT matched the search query semantically. These may be old files — do NOT assume they were recently edited unless the activity history or the "modified" timestamp confirms it.
- "System memories" = cross-app memories stored by DeepBrain. These are curated knowledge entries, not activity logs.
- "Emails" = indexed email content matching the query.

When the user asks "what was I working on?", prioritize the ACTIVITY HISTORY timeline over file search results. Activity history shows actual OS-level app switches with timestamps — this is ground truth. File search results only show files whose content matches the query, not necessarily recent activity.`
    : `You are a helpful AI assistant in DeepNote AI, a notebook application for document analysis and research.

You answer questions based on the NOTEBOOK SOURCES — documents, PDFs, pastes, and other materials uploaded to this notebook.`
  if (notebook?.description) {
    systemPrompt += `\nNotebook description: ${notebook.description}`
  }
  if (context) {
    systemPrompt += `\n\nUse the following source material to answer questions. Always cite your sources when referencing specific information using [Source N] notation.\n\n${context}`
  }
  if (context) {
    systemPrompt += `\n\nIMPORTANT — INTERACTIVE ARTIFACT RENDERING:
This application has a built-in rendering engine that displays tables and charts directly in the chat. You MUST use the artifact blocks below when the user asks to see data, charts, tables, comparisons, trends, or visualizations. Do NOT say you cannot create charts. Do NOT suggest external tools, code, or libraries. Instead, output the artifact blocks and they will be rendered automatically as interactive components.

RULES:
1. When the user asks for a table or to "show the data": output an artifact-table block with the actual data from the sources.
2. When the user asks for a chart, graph, plot, or visualization: output an artifact-chart block with the actual data extracted from the sources.
3. ALWAYS populate the artifact with REAL data from the source material — never use placeholder data.
4. You may include a brief text explanation before or after the artifact, but the artifact block itself is REQUIRED.
5. For large datasets, select the most relevant rows (up to 30) or aggregate the data (e.g. monthly totals).

TABLE FORMAT — renders as a sortable, scrollable table:
\`\`\`artifact-table
{"columns": ["Date", "Description", "Amount"], "rows": [["2025-01-15", "Netflix", "-12.99"], ["2025-01-16", "Grocery Store", "-45.20"]]}
\`\`\`

CHART FORMAT — renders as an interactive chart with tooltips and legend:
\`\`\`artifact-chart
{"chartType": "bar", "title": "Monthly Expenses", "data": [{"month": "Jan", "amount": 1200}, {"month": "Feb", "amount": 980}], "xKey": "month", "yKeys": ["amount"]}
\`\`\`

Supported chartType values: "bar", "line", "pie".
- Use "bar" for comparisons across categories.
- Use "line" for trends over time.
- Use "pie" for proportional breakdowns.
- For multiple series, add multiple keys to yKeys: ["expenses", "income"].

MERMAID DIAGRAM FORMAT — renders as an interactive diagram (flowcharts, sequence diagrams, ER diagrams, etc.):
\`\`\`artifact-mermaid
{"title": "User Flow", "code": "graph TD\\n  A[\\"Start\\"] --> B{\\"Decision\\"}\\n  B -->|Yes| C[\\"Action\\"]\\n  B -->|No| D[\\"End\\"]"}
\`\`\`
- Use when the user asks for flowcharts, diagrams, process flows, architecture diagrams, sequence diagrams, or entity relationships.
- The "code" field must contain valid Mermaid syntax. Use \\n for newlines.
- Supported diagram types: graph/flowchart, sequenceDiagram, classDiagram, erDiagram, gantt, pie, stateDiagram, journey.
- CRITICAL MERMAID SYNTAX RULES:
  1. ALWAYS include graph direction: "graph TD" or "graph LR", never just "graph"
  2. ALWAYS quote node labels: A[\\"Label\\"] not A[Label]
  3. NEVER use special characters (parentheses, colons, ampersands, angle brackets) in unquoted labels
  4. Use --> for arrows, NOT --->
  5. Keep node IDs simple alphanumeric: A, B1, step1 — no spaces or special chars in IDs
  6. Do NOT redefine the same node ID with a different label

KANBAN / ACTION ITEMS FORMAT — renders as task cards with status, assignee, and priority chips:
\`\`\`artifact-kanban
{"title": "Action Items", "items": [{"task": "Review Q3 budget", "assignee": "Finance", "priority": "high", "status": "todo"}, {"task": "Update slides", "assignee": "Marketing", "priority": "medium", "status": "in-progress"}]}
\`\`\`
- Use when the user asks for action items, task lists, to-dos, or project status boards.
- Each item has: task (required), assignee (optional), priority ("high"/"medium"/"low"), status ("todo"/"in-progress"/"done").
- Items are grouped by status into columns.

KPI / GAUGE FORMAT — renders as color-coded metric cards with progress bars:
\`\`\`artifact-kpi
{"title": "Performance Metrics", "metrics": [{"label": "NPS Score", "value": 72, "max": 100, "sentiment": "positive"}, {"label": "Churn Rate", "value": 3.2, "unit": "%", "sentiment": "warning"}]}
\`\`\`
- Use when the user asks for KPIs, scorecards, sentiment analysis, performance dashboards, or metric summaries.
- Each metric has: label, value (number), max (optional, for gauge), unit (optional, e.g. "%"), sentiment ("positive"/"warning"/"negative"/"neutral").

TIMELINE FORMAT — renders as a horizontal scrollable timeline with date markers:
\`\`\`artifact-timeline
{"title": "Project Milestones", "events": [{"date": "2025-01-15", "label": "Kickoff", "description": "Project started"}, {"date": "2025-03-01", "label": "MVP", "description": "First release"}]}
\`\`\`
- Use when the user asks for timelines, milestones, historical events, deadlines, or chronological sequences.
- Events are automatically sorted by date. Each has: date (required), label (required), description (optional).`
  }

  const lengthHint =
    notebook?.responseLength === 'short'
      ? 'Keep your response concise (2-3 paragraphs max).'
      : notebook?.responseLength === 'long'
        ? 'Provide a detailed, comprehensive response.'
        : 'Provide a moderately detailed response.'
  systemPrompt += `\n\n${lengthHint}`

  // Inject cross-session memory context
  if (notebookId) {
    try {
      const memoryContext = await memoryService.buildMemoryContext(notebookId)
      if (memoryContext) {
        systemPrompt += memoryContext
      }
    } catch {
      // Non-critical — continue without memory
    }
  }

  return systemPrompt
}

export class AiService {
  async chat(
    messages: { role: string; content: string }[],
    context: string,
    notebook?: { description?: string; responseLength?: string; hasSpreadsheetSources?: boolean },
    notebookId?: string,
    deepbrainEnabled?: boolean
  ): Promise<string> {
    const ai = getClient()
    const systemPrompt = await buildSystemPrompt(context, notebook, notebookId, deepbrainEnabled)

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }))

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: { systemInstruction: systemPrompt },
      contents,
    })
    trackGeminiResponse(response, 'gemini-3-flash-preview', 'chat')

    return response.text ?? 'No response generated.'
  }

  async chatStream(
    messages: { role: string; content: string }[],
    context: string,
    notebook?: { description?: string; responseLength?: string; hasSpreadsheetSources?: boolean },
    onChunk?: (text: string) => void,
    notebookId?: string,
    deepbrainEnabled?: boolean
  ): Promise<string> {
    const ai = getClient()
    const systemPrompt = await buildSystemPrompt(context, notebook, notebookId, deepbrainEnabled)

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }))

    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      config: { systemInstruction: systemPrompt },
      contents,
    })

    let fullText = ''
    let lastChunk: unknown
    for await (const chunk of response) {
      lastChunk = chunk
      const text = chunk.text ?? ''
      if (text) {
        fullText += text
        onChunk?.(text)
      }
    }
    if (lastChunk) trackGeminiResponse(lastChunk, 'gemini-3-flash-preview', 'chat-stream')

    return fullText || 'No response generated.'
  }

  async generateSourceGuide(text: string): Promise<string> {
    const ai = getClient()
    const truncated = text.slice(0, 30000)

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
    trackGeminiResponse(response, 'gemini-3-flash-preview', 'source-guide')

    return response.text ?? 'Summary unavailable.'
  }

  async generateContent(
    type: string,
    sourceTexts: string[],
    options?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const combinedText = sourceTexts.join('\n\n---\n\n').slice(0, 100000)
    const userDescription = options?.description ? `\nUser instructions: ${options.description}` : ''

    let prompt = ''
    switch (type) {
      case 'report': {
        const reportFormat = options?.reportFormat as string | undefined
        const formatInstruction = reportFormat
          ? `\nReport format: ${reportFormat}`
          : ''
        prompt = `You are analyzing the following source material. Generate a comprehensive report.${userDescription}${formatInstruction}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "summary": "A 2-3 sentence overview",
  "markdown": "Full report content in rich Markdown format. Use ## headings, **bold**, tables, bullet lists, numbered lists, blockquotes, and code blocks where appropriate."
}

Write detailed, well-structured markdown with 3-6 sections. Use tables for comparisons, bullet lists for key points, and clear headings. Output ONLY valid JSON, no markdown fences.`
        break
      }

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

      case 'mindmap': {
        const mmBranches = options?.mindmapBranches === 'fewer' ? '2-4' : options?.mindmapBranches === 'more' ? '5-8' : '3-6'
        const mmChildren = options?.mindmapBranches === 'fewer' ? '1-3' : options?.mindmapBranches === 'more' ? '3-6' : '2-4'
        const mmDepth = options?.mindmapDepth === 'shallow' ? '2' : options?.mindmapDepth === 'deep' ? '4' : '3'
        const mmStyleHint = options?.mindmapStyle === 'detailed' ? ' Focus on granular sub-topics with specific details.' : options?.mindmapStyle === 'relationships' ? ' Focus on connections and relationships between ideas rather than hierarchy.' : ''
        prompt = `You are creating a mind map from the following source material. Identify the central topic and main branches of ideas.${mmStyleHint}${userDescription}

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

Create ${mmBranches} main branches with ${mmChildren} children each. Go up to ${mmDepth} levels deep where appropriate. Output ONLY valid JSON, no markdown fences.`
        break
      }

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

      case 'dashboard': {
        const dbKpiCount = options?.dashboardKpiCount === 'fewer' ? '2-3' : options?.dashboardKpiCount === 'more' ? '5-8' : '3-5'
        const dbChartHint = options?.dashboardChartPreference && options.dashboardChartPreference !== 'mixed' ? ` Prefer "${options.dashboardChartPreference}" charts where appropriate.` : ''
        const dbChartRange = options?.dashboardDensity === 'compact' ? '0' : options?.dashboardDensity === 'full' ? '2-4' : '1-3'
        const dbTableRange = options?.dashboardDensity === 'compact' ? '0' : options?.dashboardDensity === 'full' ? '1-3' : '0-2'
        const dbCompactHint = options?.dashboardDensity === 'compact' ? ' Focus on KPI cards only — omit charts and tables.' : ''
        prompt = `You are creating a financial/analytical dashboard from the following source material. Extract key metrics, trends, and important data points.${dbCompactHint}${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "Dashboard Title",
  "kpis": [
    {"label": "Revenue", "value": "$1.2M", "change": "+12%", "trend": "up"}
  ],
  "charts": [
    {"chartType": "line", "title": "Revenue Trend", "data": [{"month": "Jan", "revenue": 100000}], "xKey": "month", "yKeys": ["revenue"]}
  ],
  "tables": [
    {"title": "Top Items", "columns": ["Name", "Value"], "rows": [["Item A", "100"]]}
  ]
}

Rules:
- Extract REAL data from the sources, never use placeholder data.
- Include ${dbKpiCount} KPI cards with the most important metrics. "trend" is "up", "down", or "flat".
- Include ${dbChartRange} charts. Use "line" for trends, "bar" for comparisons, "pie" for proportions.${dbChartHint}
- Include ${dbTableRange} tables if there is tabular data worth displaying.
- Supported chartType: "bar", "line", "pie".
Output ONLY valid JSON, no markdown fences.`
        break
      }

      case 'literature-review':
        prompt = `You are creating a structured academic literature review from the following source material.${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "Literature Review: [Topic]",
  "overview": "2-3 sentence overview of the literature landscape",
  "themes": [
    {"name": "Theme Name", "sources": ["Source A", "Source B"], "summary": "How this theme appears across sources"}
  ],
  "methodologyComparison": {
    "columns": ["Source", "Method", "Sample Size", "Key Finding"],
    "rows": [{"Source": "Study A", "Method": "Survey", "Sample Size": "500", "Key Finding": "..."}]
  },
  "gaps": ["Research gap 1", "Research gap 2"],
  "recommendations": ["Recommendation for future research 1"]
}

Rules:
- Identify 3-6 major themes across the sources.
- Create a methodology comparison table if sources use different approaches.
- Identify 2-4 research gaps where more work is needed.
- Provide 2-3 actionable recommendations for further research.
Output ONLY valid JSON, no markdown fences.`
        break

      case 'competitive-analysis':
        prompt = `You are creating a competitive analysis matrix from the following source material. Identify the competitors/options being compared and score them on key features.${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "Competitive Analysis: [Topic]",
  "summary": "Brief overview of the competitive landscape",
  "features": [
    {"name": "Feature Name", "weight": 1}
  ],
  "competitors": [
    {
      "name": "Competitor A",
      "scores": {"Feature Name": 8},
      "strengths": ["Key strength 1"],
      "weaknesses": ["Key weakness 1"]
    }
  ],
  "recommendation": "Based on the analysis, [recommendation]..."
}

Rules:
- Identify 4-8 key comparison features/criteria.
- Score each competitor 1-10 on each feature (10 = best).
- Include 2-3 strengths and 2-3 weaknesses for each competitor.
- Provide a clear recommendation based on the scores.
- The "scores" object keys MUST match the feature "name" values exactly.
Output ONLY valid JSON, no markdown fences.`
        break

      case 'diff':
        prompt = `You are comparing two documents clause-by-clause. The sources below represent different versions or documents to compare.${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "Document Comparison",
  "summary": "Brief summary of the key differences",
  "sourceAName": "First document name",
  "sourceBName": "Second document name",
  "sections": [
    {
      "heading": "Section/clause name",
      "sourceA": "Text from first document",
      "sourceB": "Text from second document",
      "status": "changed",
      "commentary": "AI analysis of this difference"
    }
  ]
}

Rules:
- Break the documents into logical sections/clauses for comparison.
- Status must be one of: "added" (only in B), "removed" (only in A), "changed" (both but different), "unchanged" (identical).
- Provide brief AI commentary explaining the significance of each change.
- If there are more than 2 sources, compare the first two.
- Include 5-20 sections covering the major points of comparison.
Output ONLY valid JSON, no markdown fences.`
        break

      case 'citation-graph': {
        const cgTopics = options?.citationTopicDepth === 'overview' ? '1-2' : options?.citationTopicDepth === 'detailed' ? '4-6' : '2-4'
        const cgDetailHint = options?.citationDetail === 'key-connections' ? ' Only include the strongest, most significant connections. Fewer edges, higher quality.' : options?.citationDetail === 'comprehensive' ? ' Include all connections, even weak or tangential links. More edges for a complete picture.' : ''
        prompt = `You are analyzing the relationships between the following source materials. Identify how sources relate to each other through shared topics, themes, entities, or references.${cgDetailHint}${userDescription}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "Source Relationship Graph",
  "summary": "Brief overview of the relationships between sources",
  "nodes": [
    {"id": "source-1", "label": "Source Name", "type": "paper", "topics": ["Topic 1", "Topic 2"]}
  ],
  "edges": [
    {"source": "source-1", "target": "source-2", "label": "shared topic: AI", "weight": 0.8}
  ]
}

Rules:
- Create one node per source document. Use short, descriptive labels.
- The "type" field should describe the source type (e.g., "paper", "report", "article", "book", "website").
- Include ${cgTopics} key topics per node.
- Create edges between sources that share topics, reference similar concepts, or are related.
- Edge weight is 0.0-1.0 (1.0 = strongest connection).
- Edge label should describe the relationship briefly.
- If sources don't appear related, still note any thematic connections.
Output ONLY valid JSON, no markdown fences.`
        break
      }

      case 'html-presentation': {
        // Delegate to dedicated method for backward compatibility
        const model = (options?.htmlModel as string) === 'pro' ? 'pro' : 'flash'
        return this.generateHtmlPresentation(sourceTexts, {
          model: model as 'flash' | 'pro',
          userInstructions: userDescription || undefined,
        })
      }

      default:
        throw new Error(`Unsupported content type: ${type}`)
    }

    // Use multi-agent pipeline for complex types
    if (shouldUsePipeline(type)) {
      return executePipeline(type, prompt, sourceTexts, options)
    }

    // Use validation middleware for all other types
    return generateWithValidation(type, prompt, sourceTexts, options)
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
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    trackGeminiResponse(response, 'gemini-3-flash-preview', 'studio:audio')

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
    userInstructions?: string,
    renderMode: 'full-image' | 'hybrid' = 'full-image'
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

    // For hybrid mode: ask the AI to design element positions
    const hybridLayoutSection = renderMode === 'hybrid' ? `
6.  **Element Layout (REQUIRED)**: For slides 2+, you must include an "elementLayout" array that positions the text panel. Follow the bold-label format from rule 3.
    - The slide canvas is 100% x 100%. Text goes in the LEFT ~30% (0-30%). The visual illustration covers the full slide but is less busy on the left side.
    - Each element has: type ("title"|"bullet"|"text"), content (the text), x (% from left), y (% from top), width (% of slide), fontSize (px), align ("left"|"center"|"right").
    - Title: place at top-left, moderate font (18-22px).
    - Bullets: use "Bold Label: Explanation sentence" format. Font size 12-13px. Space evenly (at least 8% vertical gap).
    - Slide 1 (title slide) does NOT need elementLayout — it renders as a full image.
` : ''

    const hybridLayoutExample = renderMode === 'hybrid' ? `,
    "elementLayout": [
      {"type": "title", "content": "How Models Learn", "x": 4, "y": 12, "width": 28, "fontSize": 20, "align": "left"},
      {"type": "text", "content": "---", "x": 4, "y": 22, "width": 8, "fontSize": 10, "align": "left"},
      {"type": "bullet", "content": "Supervised: Models train on labeled data to learn patterns", "x": 4, "y": 29, "width": 28, "fontSize": 12, "align": "left"},
      {"type": "bullet", "content": "Loss Functions: Error is measured to guide improvements", "x": 4, "y": 40, "width": 28, "fontSize": 12, "align": "left"},
      {"type": "bullet", "content": "Gradient Descent: Weights adjust iteratively to reduce error", "x": 4, "y": 51, "width": 28, "fontSize": 12, "align": "left"}
    ]` : ''

    const prompt = `You are a professional presentation designer planning a ${slideCount}-slide deck based on the source material.
Target Audience: General Professional/Educational.

SOURCE MATERIAL:
${combinedText}

${formatDirective}${userDirective}

CRITICAL RULES:
1.  **Slide Count**: You MUST output EXACTLY ${slideCount} slides. Not ${slideCount - 1}, not ${slideCount + 1}. Exactly ${slideCount}.
2.  **VISUAL + TEXT BALANCE**: Each slide combines a rich illustration with concise explanatory text. The visual is the hero (~2/3 of the slide), but the text must provide enough context that a reader can understand the slide's point without a presenter. A slide with only a title and keywords is NOT acceptable (except the title and closing slides).
3.  **Text format — "Bold Label: Explanation" pattern**: For slides 2+, use this structure in the content field:
    - A clear TITLE (3-6 words) on the first line
    - Then 2-3 KEY POINTS, each following the pattern: **Bold Label:** One explanatory sentence (10-20 words).
    - Example content: "Progressive Indexing\\n\\nInstant Availability: Queries begin immediately on partial data while full index loads in background.\\nTemperature Tiering: Hot data stays in fast fp16, cold data compresses to binary quantization automatically.\\nZero Downtime: Index upgrades happen live without taking the system offline."
    - This gives enough context to understand the topic while keeping text compact. Do NOT write full paragraphs — each point should be ONE sentence.
    - Do NOT use only bare keywords like "Fast" or "Secure" — always include the explanatory sentence.
4.  **Visuals**: For each slide, write a RICH, DETAILED visual description in visualCue. Be specific and vivid — describe the scene, metaphors, colors, mood, and composition. The visual should complement and reinforce the text points, not just be decorative. For technical topics, prefer architectural diagrams, split-views, layered visualizations, or annotated schematics over abstract art.
5.  **Content Field**: The content field is rendered as text ON the slide image. Use \\n for line breaks. Follow the bold-label format from rule 3. Aim for 3-6 lines of text total — enough to be self-explanatory, short enough to leave room for the visual.
${hybridLayoutSection}
SLIDE 1 REQUIREMENT: The first slide MUST be a "Title" layout slide with a short, punchy title (2-4 words) and one subtitle line. The visualCue should describe a dramatic, atmospheric, cinematic scene that sets the tone for the entire deck.

Output a JSON array with EXACTLY ${slideCount} objects (ONLY valid JSON, no markdown fences).

Slide 1 example (title slide — short title + subtitle, visual sets the mood):
{
  "slideNumber": 1, "layout": "Title", "title": "Machine Learning", "bullets": ["A Visual Journey"],
  "visualCue": "A vast cosmic neural network stretching across deep space — luminous nodes pulsing with warm golden light connected by flowing streams of data particles, set against a deep indigo nebula.",
  "content": "Machine Learning\\nA Visual Journey",
  "speakerNotes": "Today we explore Machine Learning — how systems learn from data."${hybridLayoutExample}
}

Slide 2+ example (content slide — bold-label format with explanatory sentences):
{
  "slideNumber": 2, "layout": "Content", "title": "How Models Learn", "bullets": ["Supervised learning uses labeled examples", "Loss functions measure prediction errors", "Gradient descent adjusts weights iteratively"],
  "visualCue": "A layered cross-section of a neural network, showing data flowing left to right through input, hidden, and output layers. Weights visualized as glowing connections of varying thickness. A gradient arrow curves back through the layers, colored in warm-to-cool spectrum.",
  "content": "How Models Learn\\n\\nSupervised Learning: Models train on labeled data, comparing predictions against known answers to improve.\\nLoss Functions: Each prediction error is measured mathematically, guiding the model toward accuracy.\\nGradient Descent: Weights are adjusted iteratively in the direction that reduces total error.",
  "speakerNotes": "The three pillars of model training: labeled data, error measurement, and iterative weight adjustment."
}

Output the full array with EXACTLY ${slideCount} slides:`

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    trackGeminiResponse(response, 'gemini-3-flash-preview', 'studio:slides')

    const responseText = response.text ?? '[]'
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const plans = JSON.parse(cleaned)
      if (!Array.isArray(plans)) throw new Error('Expected array')

      // Ensure every slide has a non-empty content field
      for (const plan of plans) {
        if (!plan.content || !plan.content.trim()) {
          plan.content = [plan.title || '', '', ...(plan.bullets || [])].join('\n')
        }
      }

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

    const lower = imagePath.toLowerCase()
    const mimeType = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg'

    const styleResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: { data: base64, mimeType },
            },
            {
              text: `You are an expert art director specializing in visual style transfer. Analyze this reference image and produce TWO things:

PART 1 — STYLE DIRECTIVE (positive):
A precise image-generation style directive describing HOW this image is rendered. This will be used to generate NEW images on COMPLETELY DIFFERENT subjects that must look like they belong in the SAME art series.

CRITICAL: Do NOT describe the SUBJECT, OBJECTS, or SCENE. ONLY describe the VISUAL RENDERING QUALITIES.

Extract ALL of the following:

1. RENDERING MEDIUM (most critical):
   - Be hyper-specific: "painterly digital illustration with visible brushstrokes" / "photorealistic cinematic still" / "matte painting" / "gouache-style fine art"
   - If it has painterly qualities, say so. If photorealistic, say so. NEVER misidentify the medium.

2. COLOR GRADING & PALETTE:
   - Exact treatment: "muted navy blues with restrained coral accents" NOT "neon blue and bright red"
   - List 4-6 dominant hex colors
   - Critically: note the SATURATION LEVEL. Is it muted/desaturated or vivid/oversaturated?

3. LIGHTING:
   - Quality, direction, color temperature
   - Is it subtle and atmospheric or dramatic and contrasty?

4. TEXTURE & FINISH:
   - Brushstroke quality, grain, surface feel
   - Film/camera effects if any

5. ARTISTIC COMPARABLE:
   - Reference specific artists, film directors, art movements, or well-known aesthetics

PART 2 — ANTI-STYLE (negative):
List what this image is NOT. This prevents the AI from defaulting to cliché interpretations.

OUTPUT FORMAT — Write EXACTLY in this structure (two paragraphs, no bullet points):

First paragraph: Start with "rendered in" or "in the style of" — the positive style directive (4-6 dense sentences).

Second paragraph: Start with "AVOID:" — list what this style is NOT. Example: "AVOID: neon glow effects, oversaturated colors, cartoon/vector illustration, flat shading, generic tech-presentation aesthetic, clipart-style icons, synthwave clichés, garish color palettes."

End with: "All generated images must faithfully reproduce this exact rendering medium, color grading, lighting, and texture consistently."

Do NOT describe what is depicted. ONLY describe HOW it is rendered and what to avoid.`,
            },
          ],
        },
      ],
    })
    trackGeminiResponse(styleResponse, 'gemini-3-flash-preview', 'style-analysis')

    return styleResponse.text ?? ''
  }

  async generateHtmlPresentation(
    sourceTexts: string[],
    options?: {
      model?: 'flash' | 'pro'
      userInstructions?: string
      cssVariables?: Record<string, string>
      styleInstructions?: string
    }
  ): Promise<{ html: string }> {
    const ai = getClient()
    const combinedText = sourceTexts.join('\n\n---\n\n').slice(0, 100000)
    const htmlModelChoice = options?.model === 'pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview'
    const userDescription = options?.userInstructions ? `\n${options.userInstructions}` : ''
    const styleHint = options?.styleInstructions ? `\n\nSTYLE DIRECTION: ${options.styleInstructions}` : ''

    // Build :root CSS variables block
    const cssVars = options?.cssVariables || {}
    const rootVarsLines = Object.entries(cssVars).map(([k, v]) => `    ${k}: ${v};`)
    const rootBlock = rootVarsLines.length > 0
      ? `  :root {\n${rootVarsLines.join('\n')}\n  }\n`
      : `  :root {
    --bg-primary: #050510;
    --bg-secondary: #0a0a1a;
    --accent-1: #6366f1;
    --accent-2: #a855f7;
    --accent-3: #ec4899;
    --text-primary: rgba(255,255,255,0.95);
    --text-secondary: rgba(255,255,255,0.85);
    --text-muted: rgba(255,255,255,0.5);
    --glass-bg: rgba(255,255,255,0.03);
    --glass-border: rgba(255,255,255,0.06);
    --particle-rgb: 99,102,241;
  }
`

    const htmlPrompt = `You are a world-class creative developer who builds award-winning animated web experiences (like Awwwards, FWA winners). Create an absolutely STUNNING, cinematic, self-contained HTML presentation from the source material below.${userDescription}${styleHint}

Source material:
${combinedText}

OUTPUT: Return ONLY raw HTML starting with <!DOCTYPE html>. No markdown fences, no backticks, no explanation text.

You MUST use this exact skeleton and fill in the content sections. Do NOT simplify or remove any visual effects.
CRITICAL: Use the CSS custom properties (var(--accent-1), var(--bg-primary), etc.) throughout the CSS. Do NOT hardcode color values — always reference the CSS variables from :root.

\`\`\`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Presentation</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<style>
${rootBlock}
  /* === RESET & BASE === */
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-snap-type: y mandatory; overflow-y: scroll; }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: var(--bg-primary);
    color: var(--text-secondary);
    overflow-x: hidden;
  }

  /* === PARTICLE CANVAS (fixed behind everything) === */
  #particles { position: fixed; inset: 0; z-index: 0; pointer-events: none; }

  /* === ANIMATED GRADIENT MESH BACKGROUND (fixed, animated) === */
  .bg-mesh {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 80% 60% at 10% 20%, color-mix(in srgb, var(--accent-1) 15%, transparent), transparent),
      radial-gradient(ellipse 60% 80% at 90% 80%, color-mix(in srgb, var(--accent-2) 12%, transparent), transparent),
      radial-gradient(ellipse 70% 50% at 50% 50%, color-mix(in srgb, var(--accent-3) 8%, transparent), transparent);
    animation: meshShift 20s ease-in-out infinite alternate;
  }
  @keyframes meshShift {
    0% { background-position: 0% 0%, 100% 100%, 50% 50%; filter: hue-rotate(0deg); }
    100% { background-position: 100% 100%, 0% 0%, 50% 50%; filter: hue-rotate(30deg); }
  }

  /* === SECTIONS === */
  section {
    min-height: 100vh; scroll-snap-align: start;
    display: flex; align-items: center; justify-content: center;
    position: relative; z-index: 1;
    padding: clamp(2rem, 5vw, 6rem);
  }
  .section-inner { max-width: 1100px; width: 100%; }

  /* === PROGRESS BAR (top) === */
  #progress {
    position: fixed; top: 0; left: 0; height: 3px; z-index: 100;
    background: linear-gradient(90deg, var(--accent-1), var(--accent-2), var(--accent-3));
    width: 0%; transition: width 0.3s ease;
  }

  /* === SLIDE COUNTER (bottom-right) === */
  #counter {
    position: fixed; bottom: 2rem; right: 2rem; z-index: 100;
    font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;
    color: var(--text-muted); letter-spacing: 0.1em;
  }

  /* === GLASSMORPHISM CARD === */
  .glass {
    background: var(--glass-bg);
    backdrop-filter: blur(24px) saturate(1.2);
    -webkit-backdrop-filter: blur(24px) saturate(1.2);
    border: 1px solid var(--glass-border);
    border-radius: 24px;
    padding: clamp(1.5rem, 3vw, 3rem);
    position: relative; overflow: hidden;
  }
  .glass::before {
    content: ''; position: absolute; inset: 0; border-radius: 24px;
    background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%);
    pointer-events: none;
  }

  /* === GRADIENT TEXT === */
  .gradient-text {
    background: linear-gradient(135deg, var(--accent-1) 0%, var(--accent-2) 50%, var(--accent-3) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* === HERO === */
  .hero-title {
    font-size: clamp(3rem, 8vw, 6rem); font-weight: 900;
    line-height: 1.05; letter-spacing: -0.03em;
    margin-bottom: 1.5rem;
  }
  .hero-subtitle {
    font-size: clamp(1.1rem, 2.5vw, 1.5rem); font-weight: 300;
    color: var(--text-muted); max-width: 600px;
    line-height: 1.7;
  }
  .hero-line {
    width: 80px; height: 3px; border-radius: 3px;
    background: linear-gradient(90deg, var(--accent-1), var(--accent-2));
    margin: 2rem 0;
  }

  /* === SECTION HEADINGS === */
  .section-heading {
    font-size: clamp(2rem, 4vw, 3rem); font-weight: 700;
    line-height: 1.2; margin-bottom: 1rem;
  }
  .section-tag {
    font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;
    font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;
    color: var(--accent-1); margin-bottom: 0.75rem; display: block;
  }

  /* === CONTENT CARDS GRID === */
  .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
  .card {
    background: var(--glass-bg); border: 1px solid var(--glass-border);
    border-radius: 20px; padding: 2rem; position: relative; overflow: hidden;
    transition: border-color 0.4s ease, transform 0.4s ease;
  }
  .card:hover { border-color: color-mix(in srgb, var(--accent-1) 30%, transparent); transform: translateY(-4px); }
  .card::after {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent-1), var(--accent-2), transparent);
    opacity: 0; transition: opacity 0.4s ease;
  }
  .card:hover::after { opacity: 1; }
  .card-icon {
    width: 40px; height: 40px; margin-bottom: 1rem; display: flex;
    align-items: center; justify-content: center; border-radius: 12px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent-1) 15%, transparent), color-mix(in srgb, var(--accent-2) 15%, transparent));
  }
  .card-icon svg { width: 20px; height: 20px; stroke: var(--accent-1); stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .card h3 { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.6rem; color: var(--text-primary); }
  .card p { font-size: 0.95rem; line-height: 1.7; color: var(--text-muted); }

  /* === BULLET LIST === */
  .bullet-list { list-style: none; margin-top: 1.5rem; }
  .bullet-list li {
    padding: 1rem 1.5rem; margin-bottom: 0.75rem;
    background: var(--glass-bg); border-left: 3px solid var(--accent-1);
    border-radius: 0 12px 12px 0; font-size: 1.05rem; line-height: 1.7;
    color: var(--text-secondary);
  }
  .bullet-list li strong { color: var(--text-primary); }

  /* === STAT / KPI BLOCKS === */
  .stat-row { display: flex; flex-wrap: wrap; gap: 2rem; margin-top: 2rem; }
  .stat {
    flex: 1; min-width: 160px; text-align: center;
    padding: 2rem 1rem; border-radius: 20px;
    background: var(--glass-bg); border: 1px solid var(--glass-border);
  }
  .stat-value {
    font-size: clamp(2rem, 4vw, 3rem); font-weight: 900; line-height: 1;
  }
  .stat-label { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; }

  /* === FINAL SLIDE === */
  .final-slide { text-align: center; }
  .final-slide .hero-title { font-size: clamp(2.5rem, 6vw, 4.5rem); }

  /* === FLOATING GLOW ORBS (decorative) === */
  .orb {
    position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; pointer-events: none;
  }

  /* === ANIMATED ELEMENTS start invisible === */
  .anim { opacity: 0; }
</style>
</head>
<body>
<div class="bg-mesh"></div>
<canvas id="particles"></canvas>
<div id="progress"></div>
<div id="counter">1 / N</div>

<!-- SECTION 1: HERO (dramatic title + subtitle + decorative line) -->
<section>
  <div class="section-inner" style="text-align:center;">
    <div class="orb" style="width:500px;height:500px;background:var(--accent-1);top:-10%;left:-10%;"></div>
    <div class="orb" style="width:400px;height:400px;background:var(--accent-2);bottom:-10%;right:-10%;"></div>
    <h1 class="hero-title gradient-text anim">YOUR TITLE HERE</h1>
    <div class="hero-line anim" style="margin:2rem auto;"></div>
    <p class="hero-subtitle anim" style="margin:0 auto;">A one-line subtitle summarizing the presentation</p>
  </div>
</section>

<!-- SECTIONS 2-N: Use a MIX of these layouts for visual variety:
     - glass card with bullet-list (bordered left-accent bullets)
     - card-grid (2-3 cards with SVG icons, h3, p)
     - stat-row (big gradient numbers + labels)
     - split layout (heading left, glass card right)
     Make each section visually DIFFERENT from the previous one.
     Use .section-tag for a small tag like "01 — TOPIC", then .section-heading.gradient-text for the heading.
-->

<!-- FINAL SECTION: big centered "Thank You" or "Key Takeaways" with gradient text -->

<script>
// === PARTICLES (uses --particle-rgb from CSS) ===
(function(){
  const c=document.getElementById('particles'),x=c.getContext('2d');
  const pRgb=getComputedStyle(document.documentElement).getPropertyValue('--particle-rgb').trim()||'99,102,241';
  let w,h,pts=[];
  function resize(){w=c.width=innerWidth;h=c.height=innerHeight;}
  resize(); addEventListener('resize',resize);
  for(let i=0;i<80;i++) pts.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.5+0.5,dx:(Math.random()-0.5)*0.3,dy:(Math.random()-0.5)*0.3,o:Math.random()*0.3+0.1});
  function draw(){
    x.clearRect(0,0,w,h);
    for(const p of pts){
      p.x+=p.dx; p.y+=p.dy;
      if(p.x<0)p.x=w; if(p.x>w)p.x=0; if(p.y<0)p.y=h; if(p.y>h)p.y=0;
      x.beginPath(); x.arc(p.x,p.y,p.r,0,Math.PI*2);
      x.fillStyle='rgba('+pRgb+','+p.o+')'; x.fill();
    }
    for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
      const d=Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y);
      if(d<120){ x.beginPath(); x.moveTo(pts[i].x,pts[i].y); x.lineTo(pts[j].x,pts[j].y);
        x.strokeStyle='rgba('+pRgb+','+(0.06*(1-d/120))+')'; x.stroke(); }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// === GSAP ANIMATIONS ===
gsap.registerPlugin(ScrollTrigger);
document.querySelectorAll('.anim').forEach(el=>{
  gsap.fromTo(el,{opacity:0, y:40, scale:0.95},{
    opacity:1, y:0, scale:1, duration:0.9, ease:'power3.out',
    scrollTrigger:{trigger:el, start:'top 85%', toggleActions:'play none none none'}
  });
});
document.querySelectorAll('section').forEach(sec=>{
  const cards=sec.querySelectorAll('.card, .bullet-list li, .stat');
  if(cards.length) gsap.fromTo(cards,{opacity:0, y:30},{
    opacity:1, y:0, duration:0.7, stagger:0.12, ease:'power2.out',
    scrollTrigger:{trigger:sec, start:'top 70%', toggleActions:'play none none none'}
  });
});

// === PROGRESS BAR & COUNTER ===
const sections=document.querySelectorAll('section');
const bar=document.getElementById('progress');
const counter=document.getElementById('counter');
const total=sections.length;
let current=0;
const obs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){
    current=[...sections].indexOf(e.target);
    bar.style.width=((current+1)/total*100)+'%';
    counter.textContent=(current+1)+' / '+total;
  }});
},{threshold:0.5});
sections.forEach(s=>obs.observe(s));

// === KEYBOARD NAV ===
document.addEventListener('keydown',e=>{
  if(['ArrowDown','ArrowRight'].includes(e.key)&&current<total-1){e.preventDefault();sections[current+1].scrollIntoView({behavior:'smooth'});}
  if(['ArrowUp','ArrowLeft'].includes(e.key)&&current>0){e.preventDefault();sections[current-1].scrollIntoView({behavior:'smooth'});}
});
</script>
</body>
</html>
\`\`\`

CRITICAL INSTRUCTIONS:
1. Use the EXACT skeleton above — keep ALL CSS, ALL JS (particles, GSAP, progress bar, keyboard nav). Do NOT simplify or remove anything.
2. Replace "YOUR TITLE HERE" with a compelling title from the source material.
3. Create 7-9 content sections between the hero and the final slide. Each section MUST use a DIFFERENT layout pattern for visual variety:
   - At least one section with .card-grid (2-3 cards with inline SVG icons in .card-icon divs — use simple Lucide-style SVG icons like arrows, lightbulbs, charts, gears, shields, etc. Example: <div class="card-icon"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>)
   - At least one section with .bullet-list inside a .glass card
   - At least one section with .stat-row (big numbers)
   - At least one section with a split layout (flex row: text left, .glass card right)
4. Every section heading uses: <span class="section-tag anim">0N — TOPIC</span><h2 class="section-heading gradient-text anim">Heading</h2>
5. Add class="anim" to ALL headings, paragraphs, cards, and content elements so GSAP animates them.
6. Add decorative .orb divs using var(--accent-1) and var(--accent-2) colors to 2-3 sections for depth.
7. The final section should be class="final-slide" with a big gradient "Key Takeaways" heading and 3-4 takeaway bullets.
8. Extract REAL, SPECIFIC content from the sources — not generic placeholder text.
9. NEVER use emojis anywhere in the HTML. Use inline SVG icons (Lucide-style, 24x24 viewBox, stroke-based) inside .card-icon divs instead. Each card should have a unique, relevant SVG icon.
10. ALWAYS use CSS custom properties (var(--accent-1), var(--bg-primary), etc.) — never hardcode hex colors for theme-related elements.
11. Return ONLY the HTML. No markdown fences. No explanation.`

    const htmlResponse = await ai.models.generateContent({
      model: htmlModelChoice,
      contents: [{ role: 'user', parts: [{ text: htmlPrompt }] }],
    })
    trackGeminiResponse(htmlResponse, htmlModelChoice, 'studio:html-presentation')

    let htmlOutput = htmlResponse.text ?? ''
    // Strip markdown fences if present
    htmlOutput = htmlOutput.replace(/^```html\n?/i, '').replace(/```\n?$/i, '').trim()

    if (!htmlOutput.includes('<!DOCTYPE') && !htmlOutput.includes('<html')) {
      throw new Error('AI did not return valid HTML output')
    }

    return { html: htmlOutput }
  }

  async suggestReportFormats(sourceTexts: string[]): Promise<ReportFormatSuggestion[]> {
    const ai = getClient()
    const combinedText = sourceTexts.join('\n\n---\n\n').slice(0, 30000)

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze the following source material and suggest 2-3 report formats that would be most appropriate for this content. Consider the type of material (academic, business, technical, narrative, etc.) and suggest formats that would best present it.

Source material (excerpt):
${combinedText}

Output a JSON array with this structure:
[
  {
    "title": "Report Format Name (e.g., Technical Analysis, Comparative Review)",
    "description": "Brief 1-sentence description of what this format does",
    "prompt": "Detailed instruction for how the report should be structured and what to emphasize"
  }
]

Output ONLY valid JSON, no markdown fences.`,
            },
          ],
        },
      ],
    })
    trackGeminiResponse(response, 'gemini-3-flash-preview', 'studio:report-suggest')

    const responseText = response.text ?? '[]'
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    try {
      const formats = JSON.parse(cleaned)
      if (!Array.isArray(formats)) return []
      return formats
    } catch {
      return []
    }
  }

  async planInfographic(
    sourceTexts: string[]
  ): Promise<{ title: string; subtitle: string; keyPoints: { heading: string; body: string; visualDescription: string }[]; colorScheme: string }> {
    const ai = getClient()
    const combinedText = sourceTexts.join('\n\n---\n\n').slice(0, 60000)

    const infographicResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze the following source material and plan an infographic that communicates the key insights clearly.

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "Infographic Title",
  "subtitle": "Brief subtitle or tagline (one sentence)",
  "keyPoints": [
    {
      "heading": "Section heading (2-4 words)",
      "body": "A concise explanation of this point in 1-2 sentences (20-40 words). Include specific data, facts, or takeaways from the source material — not just a label.",
      "visualDescription": "Description of a visual metaphor, icon, or diagram element that represents this section"
    }
  ],
  "colorScheme": "Description of recommended color scheme (e.g., 'warm earth tones with teal accents')"
}

Rules:
- Include 4-6 key points covering the most important insights from the sources.
- Each "body" must be a real explanation, not just a keyword. The reader should learn something from it.
- Example good body: "RVF files boot in under 125ms by embedding a compressed Linux unikernel directly in the artifact."
- Example bad body: "Fast boot times" (too vague, no substance).
Output ONLY valid JSON, no markdown fences.`,
            },
          ],
        },
      ],
    })
    trackGeminiResponse(infographicResponse, 'gemini-3-flash-preview', 'studio:infographic')

    const responseText = infographicResponse.text ?? '{}'
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    try {
      return JSON.parse(cleaned)
    } catch {
      throw new Error('Failed to parse infographic plan from AI response')
    }
  }

  async planWhitePaper(
    sourceTexts: string[],
    options?: { tone?: string; length?: string; userInstructions?: string }
  ): Promise<{
    title: string
    subtitle: string
    abstract: string
    tableOfContents: { number: string; title: string }[]
    sections: { number: string; title: string; content: string; imageDescription: string; imageCaption: string }[]
    references: WhitePaperReference[]
    keyFindings: string[]
    conclusion: string
  }> {
    const ai = getClient()
    const combinedText = sourceTexts.join('\n\n---\n\n').slice(0, 100000)

    const tone = options?.tone || 'business'
    const length = options?.length || 'standard'
    const userInstructions = options?.userInstructions ? `\nAdditional instructions: ${options.userInstructions}` : ''

    const toneDirective = tone === 'academic'
      ? 'Write in a formal academic tone with rigorous analysis, scholarly language, and proper academic structure. Use passive voice where appropriate and maintain objectivity.'
      : tone === 'technical'
        ? 'Write in a precise technical tone focused on implementation details, specifications, data, and actionable insights. Use clear, direct language with technical terminology.'
        : 'Write in a professional business tone that is authoritative yet accessible. Balance analytical rigor with readability for executive and stakeholder audiences.'

    const sectionCount = length === 'concise' ? '3-4' : length === 'comprehensive' ? '6-8' : '4-6'
    const contentDepth = length === 'concise' ? 'Keep each section focused and concise (2-3 paragraphs).' : length === 'comprehensive' ? 'Provide in-depth analysis with detailed paragraphs, data points, and thorough coverage (4-6 paragraphs per section).' : 'Provide moderate depth with clear analysis (3-4 paragraphs per section).'

    const prompt = `You are an expert white paper author. Create a comprehensive, professional white paper from the following source material.

TONE: ${toneDirective}
${contentDepth}${userInstructions}

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "White Paper Title — make it compelling and specific",
  "subtitle": "A descriptive subtitle or tagline",
  "abstract": "A 3-5 sentence executive summary / abstract of the entire white paper",
  "tableOfContents": [
    {"number": "1", "title": "Section Title"}
  ],
  "sections": [
    {
      "number": "1",
      "title": "Section Title",
      "content": "Full section content in rich Markdown. Use **bold**, *italic*, bullet lists, numbered lists, and tables where appropriate. Include inline citations as [1], [2] etc. referencing the references array.",
      "imageDescription": "A detailed description of a professional illustration, diagram, or data visualization that would complement this section. Be specific about the visual: chart types, elements, colors, layout.",
      "imageCaption": "Figure 1: Caption describing the image"
    }
  ],
  "references": [
    {"number": 1, "citation": "Author/Source Name, 'Title of Work or Section', Publication/Source, Date/Year. Key relevant finding or data point."}
  ],
  "keyFindings": ["Key finding 1 — a single sentence", "Key finding 2"],
  "conclusion": "A concluding section in Markdown summarizing the white paper's arguments, implications, and recommended next steps."
}

Rules:
- Create ${sectionCount} main sections plus a conclusion.
- Section 1 should be an Introduction providing context and scope.
- Each section's content must be substantive Markdown with real analysis from the sources.
- Include inline citations [1], [2] etc. throughout the content, referencing specific sources.
- Generate 4-10 references based on the actual source material provided.
- Include 3-5 key findings that summarize the white paper's most important insights.
- imageDescription should describe a specific, professional visual (NOT generic stock photos). Think: data charts, process diagrams, comparison matrices, architectural diagrams, trend visualizations.
- imageCaption should be a proper figure caption like "Figure 1: Comparison of adoption rates across industries".
- The content should flow logically and build a coherent argument.
Output ONLY valid JSON, no markdown fences.`

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    trackGeminiResponse(response, 'gemini-3-flash-preview', 'studio:whitepaper')

    const responseText = response.text ?? '{}'
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    try {
      return JSON.parse(cleaned)
    } catch {
      throw new Error('Failed to parse white paper plan from AI response')
    }
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
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
    })
    trackGeminiResponse(response, 'gemini-3-flash-preview', 'deep-research')

    onProgress?.('finalizing', 'Finalizing research report...')

    return response.text ?? 'No research results generated.'
  }
}

export const aiService = new AiService()
