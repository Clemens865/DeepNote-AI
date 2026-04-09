import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq, and, like, or, desc } from 'drizzle-orm'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { getDatabase, schema } from '../db'
import { generateWithValidation } from '../services/aiMiddleware'
import type { WikiPage, WikiLintResult } from '../../shared/types'

export function registerWikiHandlers() {
  // List wiki pages for a notebook
  ipcMain.handle(IPC_CHANNELS.WIKI_PAGES_LIST, async (_event, notebookId: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.wikiPages)
      .where(eq(schema.wikiPages.notebookId, notebookId))
  })

  // Get a single wiki page by ID
  ipcMain.handle(IPC_CHANNELS.WIKI_PAGE_GET, async (_event, id: string) => {
    const db = getDatabase()
    const rows = await db
      .select()
      .from(schema.wikiPages)
      .where(eq(schema.wikiPages.id, id))
    return rows[0] ?? null
  })

  // Create a wiki page
  ipcMain.handle(IPC_CHANNELS.WIKI_PAGE_CREATE, async (_event, args: {
    notebookId: string
    title: string
    content: string
    pageType: WikiPage['pageType']
    sourceIds?: string[]
    coverage?: WikiPage['coverage']
    confidence?: number
    relatedPages?: string[]
    tags?: string[]
  }) => {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = randomUUID()

    const page = {
      id,
      notebookId: args.notebookId,
      title: args.title,
      content: args.content,
      pageType: args.pageType,
      sourceIds: (args.sourceIds ?? []) as unknown as string,
      coverage: args.coverage ?? 'low' as const,
      confidence: args.confidence ?? 0.5,
      relatedPages: (args.relatedPages ?? []) as unknown as string,
      tags: (args.tags ?? []) as unknown as string,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(schema.wikiPages).values(page)

    // Log the creation
    await db.insert(schema.wikiLog).values({
      id: randomUUID(),
      notebookId: args.notebookId,
      action: 'create',
      details: `Created wiki page: ${args.title}`,
      sourceId: null,
      pagesAffected: [id] as unknown as string,
      createdAt: now,
    })

    return { ...page, sourceIds: args.sourceIds ?? [], relatedPages: args.relatedPages ?? [], tags: args.tags ?? [] }
  })

  // Update a wiki page
  ipcMain.handle(IPC_CHANNELS.WIKI_PAGE_UPDATE, async (_event, id: string, data: Record<string, unknown>) => {
    const db = getDatabase()
    const now = new Date().toISOString()

    const updates: Record<string, unknown> = { ...data, updatedAt: now }

    await db
      .update(schema.wikiPages)
      .set(updates)
      .where(eq(schema.wikiPages.id, id))

    const rows = await db.select().from(schema.wikiPages).where(eq(schema.wikiPages.id, id))
    const page = rows[0]

    if (page) {
      await db.insert(schema.wikiLog).values({
        id: randomUUID(),
        notebookId: page.notebookId,
        action: 'update',
        details: `Updated wiki page: ${page.title}`,
        sourceId: null,
        pagesAffected: [id] as unknown as string,
        createdAt: now,
      })
    }

    return page
  })

  // Delete a wiki page
  ipcMain.handle(IPC_CHANNELS.WIKI_PAGE_DELETE, async (_event, id: string) => {
    const db = getDatabase()

    // Remove this page ID from relatedPages of other pages
    const allPages = await db.select().from(schema.wikiPages)
    for (const page of allPages) {
      const related = (Array.isArray(page.relatedPages) ? page.relatedPages : JSON.parse(String(page.relatedPages) || '[]')) as string[]
      if (related.includes(id)) {
        const filtered = related.filter((rid) => rid !== id)
        await db
          .update(schema.wikiPages)
          .set({ relatedPages: filtered as unknown as string, updatedAt: new Date().toISOString() })
          .where(eq(schema.wikiPages.id, page.id))
      }
    }

    await db.delete(schema.wikiPages).where(eq(schema.wikiPages.id, id))
  })

  // Ingest: AI generates wiki pages from a source
  ipcMain.handle(IPC_CHANNELS.WIKI_INGEST, async (_event, args: { notebookId: string; sourceId: string }) => {
    const db = getDatabase()
    const now = new Date().toISOString()

    // 1. Read the source content
    const sourceRows = await db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.id, args.sourceId))
    const source = sourceRows[0]
    if (!source) throw new Error(`Source not found: ${args.sourceId}`)

    const sourceContent = source.content
    if (!sourceContent || sourceContent.trim().length === 0) {
      throw new Error('Source has no content to ingest')
    }

    // 2. Get existing wiki pages for context
    const existingPages = await db
      .select()
      .from(schema.wikiPages)
      .where(eq(schema.wikiPages.notebookId, args.notebookId))

    const existingTitles = existingPages.map((p) => p.title)

    // 3. Call AI to extract wiki pages
    const prompt = `You are a knowledge wiki builder. Analyze the following source material and extract structured wiki pages.

SOURCE TITLE: ${source.title}
SOURCE CONTENT:
${sourceContent.slice(0, 30000)}

EXISTING WIKI PAGES (avoid duplicates, update if overlapping):
${existingTitles.length > 0 ? existingTitles.map((t) => `- ${t}`).join('\n') : '(none yet)'}

Extract the key entities, concepts, and topics from this source. For each, create a wiki page.

Output valid JSON with this structure:
{
  "pages": [
    {
      "title": "Page Title",
      "content": "Detailed markdown content for this wiki page. Include definitions, explanations, relationships to other concepts.",
      "pageType": "entity" | "concept" | "topic" | "comparison" | "overview" | "source-summary",
      "coverage": "high" | "medium" | "low",
      "confidence": 0.0-1.0,
      "tags": ["tag1", "tag2"],
      "relatedPageTitles": ["Other Page Title"]
    }
  ]
}

Rules:
- Create 3-10 pages depending on source complexity
- Always create one "source-summary" page summarizing the entire source
- Use "entity" for people, organizations, products
- Use "concept" for abstract ideas, theories, frameworks
- Use "topic" for broader subject areas
- Content should be detailed markdown (at least 2-3 paragraphs)
- Set coverage based on how thoroughly the source covers this topic
- Set confidence based on how reliable/clear the source information is
- relatedPageTitles should reference other pages you're creating OR existing pages
- Tags should be lowercase, relevant keywords`

    const result = await generateWithValidation('wiki-ingest', prompt, [sourceContent])

    const pagesData = (result as { pages?: Array<{
      title: string
      content: string
      pageType: string
      coverage: string
      confidence: number
      tags: string[]
      relatedPageTitles: string[]
    }> }).pages

    if (!pagesData || !Array.isArray(pagesData)) {
      throw new Error('AI did not return valid wiki pages')
    }

    // 4. Create/update pages
    const createdIds: string[] = []
    let pagesCreated = 0
    let pagesUpdated = 0

    // First pass: create all pages, collecting ID mappings
    const titleToId = new Map<string, string>()
    for (const p of existingPages) {
      titleToId.set(p.title.toLowerCase(), p.id)
    }

    for (const pageData of pagesData) {
      const existingId = titleToId.get(pageData.title.toLowerCase())

      if (existingId) {
        // Update existing page — merge source IDs
        const existing = existingPages.find((ep) => ep.id === existingId)!
        const existingSourceIds = (Array.isArray(existing.sourceIds)
          ? existing.sourceIds
          : JSON.parse(String(existing.sourceIds) || '[]')) as string[]
        const mergedSourceIds = Array.from(new Set([...existingSourceIds, args.sourceId]))

        await db
          .update(schema.wikiPages)
          .set({
            content: pageData.content,
            coverage: (pageData.coverage || 'medium') as 'high' | 'medium' | 'low',
            confidence: pageData.confidence ?? 0.7,
            sourceIds: mergedSourceIds as unknown as string,
            tags: (pageData.tags || []) as unknown as string,
            updatedAt: now,
          })
          .where(eq(schema.wikiPages.id, existingId))

        createdIds.push(existingId)
        pagesUpdated++
      } else {
        // Create new page
        const id = randomUUID()
        titleToId.set(pageData.title.toLowerCase(), id)

        await db.insert(schema.wikiPages).values({
          id,
          notebookId: args.notebookId,
          title: pageData.title,
          content: pageData.content,
          pageType: (pageData.pageType || 'topic') as 'entity' | 'concept' | 'topic' | 'comparison' | 'overview' | 'source-summary',
          sourceIds: [args.sourceId] as unknown as string,
          coverage: (pageData.coverage || 'medium') as 'high' | 'medium' | 'low',
          confidence: pageData.confidence ?? 0.7,
          relatedPages: [] as unknown as string,
          tags: (pageData.tags || []) as unknown as string,
          createdAt: now,
          updatedAt: now,
        })

        createdIds.push(id)
        pagesCreated++
      }
    }

    // Second pass: resolve relatedPageTitles to IDs
    for (const pageData of pagesData) {
      const pageId = titleToId.get(pageData.title.toLowerCase())
      if (!pageId) continue

      const relatedIds = (pageData.relatedPageTitles || [])
        .map((t) => titleToId.get(t.toLowerCase()))
        .filter((rid): rid is string => !!rid && rid !== pageId)

      if (relatedIds.length > 0) {
        await db
          .update(schema.wikiPages)
          .set({ relatedPages: relatedIds as unknown as string, updatedAt: now })
          .where(eq(schema.wikiPages.id, pageId))
      }
    }

    // 5. Log the ingest
    await db.insert(schema.wikiLog).values({
      id: randomUUID(),
      notebookId: args.notebookId,
      action: 'ingest',
      details: `Ingested source "${source.title}": created ${pagesCreated} pages, updated ${pagesUpdated} pages`,
      sourceId: args.sourceId,
      pagesAffected: createdIds as unknown as string,
      createdAt: now,
    })

    return { pagesCreated, pagesUpdated, pageIds: createdIds }
  })

  // Query: search wiki pages by title and content
  ipcMain.handle(IPC_CHANNELS.WIKI_QUERY, async (_event, args: { notebookId: string; query: string; limit?: number }) => {
    const db = getDatabase()
    const pattern = `%${args.query}%`
    const limit = args.limit ?? 20

    const results = await db
      .select()
      .from(schema.wikiPages)
      .where(
        and(
          eq(schema.wikiPages.notebookId, args.notebookId),
          or(
            like(schema.wikiPages.title, pattern),
            like(schema.wikiPages.content, pattern)
          )
        )
      )
      .limit(limit)

    // Log the query
    await db.insert(schema.wikiLog).values({
      id: randomUUID(),
      notebookId: args.notebookId,
      action: 'query',
      details: `Searched wiki for: "${args.query}" — ${results.length} results`,
      sourceId: null,
      pagesAffected: results.map((r) => r.id) as unknown as string,
      createdAt: new Date().toISOString(),
    })

    return results
  })

  // Lint: check for wiki quality issues
  ipcMain.handle(IPC_CHANNELS.WIKI_LINT, async (_event, notebookId: string) => {
    const db = getDatabase()
    const now = new Date().toISOString()

    const allPages = await db
      .select()
      .from(schema.wikiPages)
      .where(eq(schema.wikiPages.notebookId, notebookId))

    // Orphan pages: no source references
    const orphanPages = allPages.filter((p) => {
      const sids = (Array.isArray(p.sourceIds) ? p.sourceIds : JSON.parse(String(p.sourceIds) || '[]')) as string[]
      return sids.length === 0
    })

    // Low coverage pages
    const lowCoveragePages = allPages.filter((p) => p.coverage === 'low')

    // Unlinked pages: not referenced by any other page's relatedPages
    const allRelatedIds = new Set<string>()
    for (const page of allPages) {
      const related = (Array.isArray(page.relatedPages) ? page.relatedPages : JSON.parse(String(page.relatedPages) || '[]')) as string[]
      for (const rid of related) {
        allRelatedIds.add(rid)
      }
    }
    const unlinkedPages = allPages.filter((p) => !allRelatedIds.has(p.id))

    const result: WikiLintResult = {
      orphanPages: orphanPages as unknown as WikiPage[],
      lowCoveragePages: lowCoveragePages as unknown as WikiPage[],
      unlinkedPages: unlinkedPages as unknown as WikiPage[],
    }

    // Log the lint
    await db.insert(schema.wikiLog).values({
      id: randomUUID(),
      notebookId,
      action: 'lint',
      details: `Lint: ${orphanPages.length} orphan, ${lowCoveragePages.length} low-coverage, ${unlinkedPages.length} unlinked`,
      sourceId: null,
      pagesAffected: [] as unknown as string,
      createdAt: now,
    })

    return result
  })

  // Wiki activity log
  ipcMain.handle(IPC_CHANNELS.WIKI_LOG_LIST, async (_event, args: { notebookId: string; limit?: number }) => {
    const db = getDatabase()
    const limit = args.limit ?? 50

    return db
      .select()
      .from(schema.wikiLog)
      .where(eq(schema.wikiLog.notebookId, args.notebookId))
      .orderBy(desc(schema.wikiLog.createdAt))
      .limit(limit)
  })
}
