import { GoogleGenAI } from '@google/genai'
import { configService } from './config'
import { generateWithValidation, resetMiddlewareClient } from './aiMiddleware'
import { shouldUsePipeline, executePipeline } from './generationPipeline'
import { memoryService } from './memory'
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

async function buildSystemPrompt(
  context: string,
  notebook?: { description?: string; responseLength?: string; hasSpreadsheetSources?: boolean },
  notebookId?: string
): Promise<string> {
  let systemPrompt = `You are a helpful AI assistant in DeepNote AI, a notebook application integrated with SuperBrain — a system-wide cognitive engine.

CRITICAL: You have access to TWO data sources:
1. NOTEBOOK SOURCES — documents, PDFs, pastes uploaded to this notebook
2. SYSTEM-WIDE DATA (SuperBrain) — the user's emails, local files, clipboard history, and cross-app memories

NEVER say "I cannot access your emails" or "I don't have access to your files." Instead, check the system-wide data section below. If SuperBrain found matching data, USE IT. If SuperBrain is connected but found nothing, tell the user the specific content wasn't found in the indexed files. If SuperBrain is not running, tell the user to start SuperBrain to enable system-wide search.`
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
{"title": "User Flow", "code": "graph TD\\n  A[Start] --> B{Decision}\\n  B -->|Yes| C[Action]\\n  B -->|No| D[End]"}
\`\`\`
- Use when the user asks for flowcharts, diagrams, process flows, architecture diagrams, sequence diagrams, or entity relationships.
- The "code" field must contain valid Mermaid syntax. Use \\n for newlines.
- Supported diagram types: graph/flowchart, sequenceDiagram, classDiagram, erDiagram, gantt, pie, stateDiagram, journey.

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
    notebookId?: string
  ): Promise<string> {
    const ai = getClient()
    const systemPrompt = await buildSystemPrompt(context, notebook, notebookId)

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
    notebook?: { description?: string; responseLength?: string; hasSpreadsheetSources?: boolean },
    onChunk?: (text: string) => void,
    notebookId?: string
  ): Promise<string> {
    const ai = getClient()
    const systemPrompt = await buildSystemPrompt(context, notebook, notebookId)

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
6.  **Element Layout (REQUIRED)**: For slides 2+, you must include an "elementLayout" array that defines exactly where each text element should be positioned on the slide. Think like a graphic designer — consider visual hierarchy, reading flow, spacing, and balance with the right-side illustration.
    - The slide canvas is 100% x 100%. The LEFT HALF (0-48%) is for text. The RIGHT HALF has the illustration.
    - Each element has: type ("title"|"bullet"|"text"), content (the text), x (% from left), y (% from top), width (% of slide), fontSize (px), align ("left"|"center"|"right").
    - Title: place at top-left area, larger font (20-28px), bold positioning.
    - Bullets: space them evenly below the title with breathing room (at least 10% vertical gap between items).
    - Consider the number of bullets: fewer bullets = more spacing, larger fonts. Many bullets = tighter spacing, smaller fonts.
    - Slide 1 (title slide) does NOT need elementLayout — it renders as a full image.
` : ''

    const hybridExample = renderMode === 'hybrid' ? `,
    "elementLayout": [
      {"type": "title", "content": "Machine Learning", "x": 4, "y": 12, "width": 42, "fontSize": 24, "align": "left"},
      {"type": "text", "content": "---", "x": 4, "y": 23, "width": 10, "fontSize": 10, "align": "left"},
      {"type": "bullet", "content": "Systems that learn from data", "x": 4, "y": 30, "width": 42, "fontSize": 15, "align": "left"},
      {"type": "bullet", "content": "Three core paradigms", "x": 4, "y": 42, "width": 42, "fontSize": 15, "align": "left"}
    ]` : ''

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
${hybridLayoutSection}
SLIDE 1 REQUIREMENT: The first slide MUST be a "Title" layout slide. It should have a strong presentation title as the title, and one or two subtitle bullets (e.g. a tagline/subtitle and "Presented by [relevant entity or topic area]"). The content field should show the title prominently with the subtitle below.

Output a JSON array with EXACTLY ${slideCount} objects (ONLY valid JSON, no markdown fences):
[
  {
    "slideNumber": 1,
    "layout": "Title",
    "title": "Machine Learning",
    "bullets": ["Systems that learn and improve from data", "A Comprehensive Overview"],
    "visualCue": "A futuristic digital brain with neural network connections glowing, abstract data particles flowing around it.",
    "content": "Machine Learning\\n\\nSystems that learn and improve from data\\nA Comprehensive Overview",
    "speakerNotes": "Welcome. Today we explore Machine Learning — the subset of AI that enables systems to learn from data. We will cover supervised, unsupervised, and reinforcement learning."${hybridExample}
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

    return response.text ?? ''
  }

  async suggestReportFormats(sourceTexts: string[]): Promise<ReportFormatSuggestion[]> {
    const ai = getClient()
    const combinedText = sourceTexts.join('\n\n---\n\n').slice(0, 30000)

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze the following source material and plan a visually appealing infographic.

Source material:
${combinedText}

Output a JSON object with this structure:
{
  "title": "Infographic Title",
  "subtitle": "Brief subtitle or tagline",
  "keyPoints": [
    {
      "heading": "Section heading",
      "body": "Key fact or statistic (keep very concise)",
      "visualDescription": "Description of icon or visual element for this section"
    }
  ],
  "colorScheme": "Description of recommended color scheme (e.g., 'warm earth tones with teal accents')"
}

Include 4-6 key points. Each should be concise and visually representable. Output ONLY valid JSON, no markdown fences.`,
            },
          ],
        },
      ],
    })

    const responseText = response.text ?? '{}'
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
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

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
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
    })

    onProgress?.('finalizing', 'Finalizing research report...')

    return response.text ?? 'No research results generated.'
  }
}

export const aiService = new AiService()
