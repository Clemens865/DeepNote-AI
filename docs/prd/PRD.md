# Product Requirements Document: DeepNote Obsidian-Class Upgrade + Karpathy Knowledge Wiki

*Generated: 2026-04-06*

---

## 0. Research Foundation

- **Based on:** Deep analysis of Obsidian (1800+ community plugins, markdown-native editing, bidirectional linking, graph visualization, canvas) and Andrej Karpathy's LLM Wiki concept (persistent AI-maintained knowledge pages vs. stateless chat-based RAG).
- **Opportunity:** DeepNote already has AI-powered source ingestion with RAG and a notes system for human knowledge capture -- but they exist in separate silos. The notes system is a plain textarea. The AI has no persistent memory. This upgrade fuses Obsidian-class knowledge management UX with an AI-native intelligence layer that Obsidian cannot replicate, creating a tool where human notes and AI-synthesized knowledge live in the same graph, link to the same sources, and reinforce each other.
- **Narrowest wedge:** Replace the plain textarea note editor with a Tiptap-based markdown editor (Sprint 1). This single change unlocks every subsequent tier -- you cannot have block references without blocks, a knowledge graph without parseable links, or wiki pages without rich formatting.

---

## 1. Executive Summary

**Problem.** DeepNote's notes system is a plain textarea with flat organization, no graph, no workflow primitives, and complete isolation from the AI. Users who take research seriously use a second app (Obsidian, Notion) for knowledge management.

**Solution.** A 6-sprint upgrade delivering: (1) a Tiptap rich markdown editor, (2) folder hierarchy + search, (3) interactive knowledge graph, (4) daily notes/templates/tasks, (5) AI-maintained knowledge wiki from sources, and (6) spatial canvas + AI-native features.

**Target user.** Research-focused knowledge workers who ingest 10-50+ sources per project, take extensive notes, and want a single tool where sources, AI insights, and personal notes converge into a navigable knowledge graph.

**Key differentiator.** The Karpathy Knowledge Wiki -- the AI continuously maintains structured, persistent wiki pages synthesized from ingested sources. Every claim cites its source. Coverage indicators show what the AI knows well. Queries hit the wiki first, falling back to RAG only when the wiki lacks coverage.

**Narrowest wedge.** Sprint 1 (Tiptap editor) ships in 3 weeks and delivers immediate value: formatted notes with wiki links. MVP (Sprints 1-2) ships in 5 weeks.

---

## 2. Vision & Scope

**Vision.** Transform DeepNote from a research assistant with a scratchpad into a research assistant with an Obsidian-class knowledge management system where human notes and AI-synthesized wiki pages coexist in a single, interconnected knowledge graph.

**Five problems solved:** (1) Plain textarea editing, (2) Flat organization, (3) Disconnected links with no graph, (4) No workflow primitives, (5) AI and notes are siloed.

**Anti-goals (what this is NOT):**
1. Not a standalone notes app or Obsidian competitor for generic note-taking
2. Not a plugin ecosystem -- no plugin API or marketplace
3. Not a cloud sync service -- local-first always
4. Not a replacement for existing AI chat -- wiki augments chat
5. Not full Obsidian feature parity -- 20% of features for 80% of research value
6. Not a separate product -- upgrade to the existing app
7. Not AI-generated-only content -- human-governed, AI-maintained

**Primary user.** Research-focused knowledge worker who ingests 10-50+ sources, takes extensive notes, values local-first data ownership, is comfortable with markdown, and currently uses a second app for knowledge management.

**Success criteria:** Editor adoption (80% use formatting in 30 days), notes volume 3x in 60 days, 50% single-tool consolidation in 90 days, 40% weekly graph engagement, 60% wiki coverage utilization, 40% wiki-first query hit rate, 25% retention increase.

> See [vision-scope.md](./vision-scope.md) for the full vision and scope document.

---

## 3. User Journeys

Five core scenarios trace the full journey from trigger to resolution:

| # | Scenario | Persona | Magic Moment |
|---|----------|---------|--------------|
| 1 | Research & Note-Taking | Maya, PhD student | Types `[[` and sees AI-generated wiki pages she never wrote |
| 2 | Knowledge Discovery via Graph | David, journalist | Graph reveals 3 entities are aliases for the same lobbying firm |
| 3 | AI Wiki Ingest | Kenji, startup CTO | Opens a wiki page the AI built incrementally from 3 separate sources |
| 4 | Daily Knowledge Work | Priya, product manager | Daily note shows 5 open tasks pulled from 12 different notes |
| 5 | Canvas Planning | Rafa, UX researcher | "Summarize Selection" on 4 interview cards produces grounded synthesis |

A full "Day in the Life" narrative traces Priya through all 5 scenarios across a single workday: morning kickoff, source ingest, stakeholder meeting, knowledge discovery, canvas synthesis, and end-of-day reflection.

**Critical path for launch:** Rich editor + wiki links + AI wiki ingest + backlinks/unlinked mentions.

> See [user-journeys.md](./user-journeys.md) for detailed scenario maps with edge cases and the dependency chain.

---

## 4. Requirements Overview

### Functional Requirements by Tier

| Tier | Name | Count | Key Requirements |
|------|------|-------|-----------------|
| 1 | Editor | 14 | Tiptap editor, 3 editing modes, callouts, KaTeX, Mermaid, code blocks, transclusion, block refs, frontmatter, slash commands |
| 2 | Organization | 10 | Folders, quick switcher, command palette, FTS, outline, bookmarks, aliases, nested tags |
| 3 | Graph | 7 | Global/local graph, unlinked mentions, link badges, graph filters/search, node coloring |
| 4 | Workflows | 7 | Daily notes, templates, periodic notes, task checkboxes, task queries, kanban, dataview |
| 5 | Canvas | 7 | Infinite canvas, note cards, image/link embeds, text cards, arrows, groups, JSON storage |
| 6 | Wiki | 11 | AI ingest pipeline, wiki page types, index, log, coverage, confidence, wiki-first query, lint |
| 7 | AI-Native | 9 | Auto-tag, auto-link, hybrid search, summarization, content generation, voice, web clipper, inline AI |

### Non-Functional Requirements: 15 (performance, storage, accessibility, reliability, memory, startup)

### Data Requirements: 13 tables (new or altered), all SQLite + Drizzle ORM

### Integration Requirements: 11 (vector store, AI providers, source ingestion, chat, IPC, voice, web scraper, knowledge hub)

### Constraints: 10 (Electron sandbox, backward compatibility, offline, SQLite-only, Drizzle migrations, bundle size, markdown export, graph/canvas off-main-thread, theme system)

> See [requirements.md](./requirements.md) for the full requirements tables with acceptance criteria.

---

## 5. Architecture Overview

```
ELECTRON 39 SHELL
+-- RENDERER (React 19 + Tailwind v4)
|   +-- Notes Workspace: Folder Explorer, Tiptap Editor, Quick Switcher, Command Palette
|   +-- Canvas/Graph Views: tldraw Canvas, Cytoscape Graph, Wiki Viewer, Template Browser
|   +-- Zustand Stores: noteTree, canvas, graph, wiki, search, task, template
+-- IPC BRIDGE (~205 channels: 168 existing + ~37 new)
+-- MAIN PROCESS (Node.js)
    +-- IPC Handlers: folders, canvas, wiki, tasks, templates
    +-- Services: Search (FTS5 + Vector), Wiki Generator (AI Provider), Task Scheduler
    +-- SQLite (better-sqlite3 + Drizzle ORM): existing tables + 8 new tables + FTS5
```

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Graph library | Cytoscape.js | Best graph-specific API; Cola layout for dynamic graphs |
| Canvas engine | tldraw | Full freeform canvas, MIT-licensed, embeds in React |
| Wiki storage | SQLite tables | Single DB, FTS5 indexing, transactional revisions |
| Search | FTS5 + existing vector store | Zero-dependency FTS, combine with ONNX/Gemini embeddings |
| Tiptap extensions | Hybrid (npm StarterKit + custom) | StarterKit for 80%; custom for wiki-links, tags, slash, task sync |
| State management | New Zustand stores per domain | Keeps existing stores stable; cross-store via subscribe |
| Content format | Tiptap JSON stored, markdown import/export | Preserves block structure; backward compat via lazy migration |

> See [architecture-sketch.md](./architecture-sketch.md) for the full system diagram, schema DDL, data flow, and IPC channel plan.

---

## 6. Roadmap

| Sprint | Name | Duration | Goal |
|--------|------|----------|------|
| 1 | Editor Foundation | 3 weeks | Tiptap editor replacing textarea; markdown, callouts, math, wiki links, migration |
| 2 | Organization & Search | 2 weeks | Folders, quick switcher, FTS5 search, outline, command palette |
| 3 | Knowledge Graph | 2 weeks | Global/local graph, backlinks, unlinked mentions, graph filters |
| 4 | Workflows | 3 weeks | Daily notes, templates, task checkboxes, task aggregation |
| 5 | Knowledge Wiki | 4 weeks | AI wiki generation, incremental enrichment, contradictions, wiki-first query |
| 6 | Canvas + AI-Native | 4 weeks | Spatial canvas, auto-tag, auto-link, summarize selection |

**MVP = Sprints 1-2 (5 weeks).** Delivers rich editor + folders + search. Users can stop switching to Obsidian for note-taking.

**Total timeline: ~18 weeks** (with parallelization opportunities between Sprints 3-4).

> See [risks-and-priorities.md](./risks-and-priorities.md) for full MoSCoW prioritization per sprint and MVP definition.

---

## 7. Risks

### Top 10 Risks (by L x I score)

| # | Risk | Score | Category | Mitigation |
|---|------|-------|----------|------------|
| 2 | Graph layout freezes UI at 500+ nodes | 16 | Technical | WebGL renderer, Web Worker, LOD rendering |
| 6 | Scope creep toward full Obsidian parity | 16 | Scope | Anti-goals gate; sprint scope locked 1 week before start |
| 1 | Tiptap performance on notes >10K words | 15 | Technical | Virtual rendering; hard perf budget (keystroke <16ms) |
| 8 | AI wiki hallucinates facts not in sources | 15 | AI | Strict grounding with source citations; hallucination detection |
| 3 | Canvas embedded editors cause memory leaks | 12 | Technical | Virtualize off-screen; mount/unmount Tiptap on visibility |
| 7 | Wiki quality varies across providers | 12 | AI | Provider-agnostic prompts; quality scoring; confidence badges |
| 10 | UX complexity overwhelms users | 12 | UX | Progressive disclosure; features hidden until opt-in |
| 4 | Editor migration corrupts existing notes | 10 | Integration | Plain text = valid markdown; migration tests; fallback textarea |
| 9 | Wiki concept deduplication fails | 9 | AI | Embedding similarity check; merge UI; alias system |
| 11 | Task aggregation slow with 500+ notes | 9 | Technical | Indexed task store; incremental updates; query cache |

> See [risks-and-priorities.md](./risks-and-priorities.md) for the full 14-risk matrix with scoring.

---

## 8. Validation Plan

### Critical Assumptions (12 total)

Highest-risk assumptions requiring pre-sprint validation:
- **A3:** Force-directed graph at 500+ nodes (Low confidence) -- benchmark pre-Sprint 3
- **A4:** Users actually want an AI-maintained wiki (Medium confidence) -- validate with interviews pre-Sprint 5
- **A5:** Wiki quality across all providers (Low confidence) -- blind evaluation pre-Sprint 5
- **A6:** Hallucination rate <5% (Low confidence) -- controlled test early Sprint 5

### Kill Criteria (non-negotiable)

| Signal | Threshold | Action |
|--------|-----------|--------|
| Editor keystroke latency >30ms P95 after optimization | Sprint 1 week 2 | Pause; evaluate CodeMirror 6 |
| Note migration loses content for >1% of notes | Sprint 1 | Ship editor as opt-in only |
| Existing IPC tests fail after additions | Any sprint | Revert; zero tolerance for regressions |
| Wiki hallucination >10% | Sprint 5 week 1 | Pause wiki; invest in grounding pipeline |
| <5% MVP users use formatting after 30 days | Post-MVP | Core hypothesis wrong; pause Sprints 3-6 |
| <2/5 interview interest in AI wiki | Pre-Sprint 5 | Reduce to "AI summary per source" (1 week) |

### Decision Gates

| Timeframe | Decision | Go Criteria |
|-----------|----------|-------------|
| MVP + 2 weeks | Start Graph | >60% editor adoption; positive interviews |
| MVP + 4 weeks | Start Workflows | >25% graph usage; note volume trending 3x |
| Pre-Sprint 5 | Commit to Wiki | 4/5+ interview interest; provider quality >3.5; hallucination <5% |
| Pre-Sprint 6 | Commit to Canvas | >30% wiki adoption; canvas demand validated |

> See [validation-plan.md](./validation-plan.md) for full assumption table, validation methods, per-sprint acceptance criteria, and post-MVP tracking plan.

---

## 9. Open Questions

### Technical
1. Should Tiptap JSON be the canonical storage format, or should we store markdown and parse to Tiptap on load? (Current recommendation: Tiptap JSON canonical, markdown export.)
2. What is the right embedding-similarity threshold for wiki concept deduplication?
3. Should canvas arrows optionally create `[[wiki links]]` or remain purely visual?

### Product
4. How aggressive should AI auto-tagging be? (Suggestions after 2s idle vs. on-save only?)
5. Should wiki pages be editable with the full rich editor, or a simplified viewer?
6. Is "wiki-first query" transparent to the user, or does the UI show "answered from wiki" vs. "answered from RAG"?

### Scope
7. Voice-to-note and web clipper are "Could" in Sprint 6 -- do we promote them to "Should" based on user demand?
8. Should we invest in nested tags (FR-ORG-09) in Sprint 2, or defer to a later sprint?
9. What is the right default daily note template for first-time users?

---

## Appendix: Detailed Documents

| Document | Description |
|----------|-------------|
| [vision-scope.md](./vision-scope.md) | Full vision, anti-goals, primary user, success criteria |
| [user-journeys.md](./user-journeys.md) | 5 scenario maps + "Day in the Life" + critical path analysis |
| [requirements.md](./requirements.md) | 65 functional + 15 non-functional + 13 data + 11 integration + 10 constraint requirements |
| [architecture-sketch.md](./architecture-sketch.md) | System diagram, component table, technical decisions, schema DDL, data flows, IPC plan |
| [risks-and-priorities.md](./risks-and-priorities.md) | 14-risk matrix, MoSCoW per sprint, phased roadmap, MVP definition |
| [validation-plan.md](./validation-plan.md) | 12 assumptions, validation methods, kill criteria, per-sprint acceptance, decision gates |
