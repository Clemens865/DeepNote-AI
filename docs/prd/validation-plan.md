# DeepNote AI Notes Upgrade: Validation Plan

**Version:** 1.0
**Date:** 2026-04-06

---

## Critical Assumptions

| # | Assumption | Confidence | Evidence | What Breaks If Wrong |
|---|-----------|-----------|----------|---------------------|
| 1 | Tiptap can handle all required markdown extensions (callouts, LaTeX, Mermaid, block refs, wiki links) without major custom node development | Medium | Tiptap already in codebase for Studio; extensions exist for math/code, but callouts and block refs are custom | Sprint 1 scope doubles. Editor foundation delays cascade to every subsequent sprint. |
| 2 | Tiptap editor maintains <16ms keystroke latency on 10K+ word notes with heavy embeds | Medium | No internal benchmarks yet; Tiptap uses ProseMirror which handles large docs well in theory | Core editor feels sluggish. Users revert to external tools. Entire upgrade loses credibility on day one. |
| 3 | Force-directed graph renders 500+ nodes at 60fps with WebGL (force-graph lib) | Low | Library benchmarks exist but not with our data shape (mixed note/wiki/source nodes, variable edge density) | Graph view is unusable for power users with large notebooks. Sprint 3 value proposition collapses. |
| 4 | Users actually want an AI-maintained wiki (not just better RAG answers) | Medium | Karpathy blog post resonated widely; no direct user validation on DeepNote's audience | Sprint 5 (4 weeks, the largest sprint) delivers a feature nobody uses. Massive wasted effort. |
| 5 | AI wiki quality is high enough across all supported providers (Gemini, Claude, OpenAI, Groq) | Low | Provider quality varies significantly for structured extraction tasks; Groq (Llama) likely weakest | Users on cheaper/weaker providers get bad wiki pages, lose trust in the system, disable the feature. |
| 6 | Wiki hallucination rate stays below 5% with grounding prompts | Low | No empirical data yet; grounding quality depends on chunk quality, prompt engineering, and provider | Users find false claims in wiki pages, lose trust in all AI-generated content. Reputation damage. |
| 7 | Existing notes migrate losslessly to the new Tiptap editor | High | Plain text is valid markdown; no format conversion needed. Risk is edge cases (unusual characters, very long lines). | Data loss on upgrade. Users lose trust. Potential support crisis. |
| 8 | SQLite FTS5 handles full-text search across 500+ notes in <200ms | High | FTS5 is mature and well-benchmarked for this scale; similar to what Obsidian does locally | Search feels slow. Users keep using OS-level search or external tools. |
| 9 | New IPC channels for notes/graph/wiki do not break existing chat/source functionality | High | Additive extension pattern is established; integration test suite exists | Regression in core product. Users who depend on chat/sources hit bugs. Highest-severity issue. |
| 10 | Wiki concept deduplication works well enough to avoid duplicate pages ("ML" vs "machine learning") | Low | Embedding similarity is good but not perfect; domain-specific synonyms are hard | Wiki becomes cluttered with near-duplicate pages. Users must manually merge, defeating the "automatic" value prop. |
| 11 | Progressive disclosure prevents UX overwhelm as features accumulate across 6 sprints | Medium | Planned but not designed yet; Obsidian solves this with community defaults, we cannot | New users face a complex UI. Onboarding friction increases. Retention drops instead of improving. |
| 12 | Canvas with embedded Tiptap instances does not cause memory leaks at 100+ nodes | Medium | Mount/unmount strategy planned but untested; each Tiptap instance has nontrivial memory footprint | Canvas becomes unusable in extended sessions. Users lose work to crashes. Sprint 6 is unreliable. |

---

## Validation Methods

### A1: Tiptap Extension Feasibility (Medium confidence)

**Method:** Build a standalone prototype of each custom node (callout, block reference, wiki link autocomplete, LaTeX inline) in isolation before Sprint 1 begins. Time-box to 3 days.

**Success signal:** All 4 custom nodes render correctly, support undo/redo, and serialize to/from markdown without data loss. No node requires more than 200 lines of custom code.

**Failure signal:** Any node requires patching Tiptap core, or markdown round-tripping loses formatting.

**Time to validate:** 3 days (pre-Sprint 1).

---

### A2: Editor Performance (Medium confidence)

**Method:** Create a synthetic 15K-word note with 20 LaTeX blocks, 5 Mermaid diagrams, 30 wiki links, 10 callouts. Measure keystroke latency in Chrome DevTools Performance tab on a mid-range machine.

**Success signal:** P95 keystroke latency <16ms. Scroll remains smooth (60fps).

**Failure signal:** P95 latency >30ms, or visible jank on scroll.

**Time to validate:** 1 day (during Sprint 1, week 1).

---

### A3: Graph Performance at Scale (Low confidence)

**Method:** Generate a synthetic dataset of 1000 notes with 5000 edges. Load into force-graph in a Web Worker. Measure fps during pan/zoom on a mid-range machine and a low-end machine.

**Success signal:** 60fps at 500 nodes, 30fps at 1000 nodes on mid-range. Graceful degradation (LOD collapsing) on low-end.

**Failure signal:** Below 30fps at 500 nodes, or Web Worker communication overhead causes visible delay on node click.

**Time to validate:** 2 days (pre-Sprint 3 or early Sprint 3).

---

### A4: User Demand for AI Wiki (Medium confidence)

**Method:** After MVP ships (Sprints 1-2), add a "coming soon" teaser card for the Knowledge Wiki in the sidebar. Track click-through rate. Run 5 user interviews with power users asking: "If the AI automatically maintained wiki pages from your sources, would you use them? What would make you trust them?"

**Success signal:** >20% click-through on teaser. 4/5 interviewees express strong interest with specific use cases.

**Failure signal:** <5% click-through. Interviewees say "I prefer writing my own notes" or "I do not trust AI summaries."

**Time to validate:** 2-4 weeks (during Sprints 3-4, before Sprint 5 investment).

---

### A5: Wiki Quality Across Providers (Low confidence)

**Method:** Take 5 diverse PDFs (academic paper, earnings report, technical doc, news article, book chapter). Run wiki generation with each provider. Blind-evaluate output on: factual accuracy, coverage, readability, citation quality. Score 1-5 per dimension.

**Success signal:** All providers score >= 3.5 average. No provider scores <3 on factual accuracy.

**Failure signal:** Any provider scores <2.5 average, or >10% of claims are ungrounded.

**Time to validate:** 3 days (pre-Sprint 5).

---

### A6: Hallucination Rate (Low confidence)

**Method:** Generate wiki pages from 10 sources with known content. Manually verify every claim against source material. Calculate grounded vs. ungrounded claim ratio.

**Success signal:** >95% of claims are traceable to a specific source passage.

**Failure signal:** >10% of claims cannot be traced, or any claim directly contradicts source material.

**Time to validate:** 3 days (early Sprint 5).

---

### A10: Concept Deduplication (Low confidence)

**Method:** Ingest 20 sources with known overlapping terminology (acronyms, synonyms, abbreviations). Count duplicate wiki pages created. Test the embedding-similarity merge threshold.

**Success signal:** <10% duplicate pages. Merge suggestions catch >80% of true duplicates.

**Failure signal:** >25% duplicates, or merge suggestions produce >20% false positives (merging genuinely distinct concepts).

**Time to validate:** 2 days (early Sprint 5).

---

### A11: Progressive Disclosure (Medium confidence)

**Method:** After Sprint 3, run a 5-person usability test with new users (never seen DeepNote). Observe: can they create a note, find a note, and understand the sidebar without guidance? Measure time-to-first-formatted-note and count confusion points.

**Success signal:** 4/5 users create a formatted note in <3 minutes. No user expresses overwhelm.

**Failure signal:** >2 users cannot find how to create a note, or describe the UI as "cluttered" or "confusing."

**Time to validate:** 1 day (post-Sprint 3).

---

## Kill Criteria

| Signal | Threshold | Action |
|--------|-----------|--------|
| Editor keystroke latency exceeds 30ms P95 on a 5K-word note after 1 week of optimization | Sprint 1, week 2 | Pause. Evaluate switching to CodeMirror 6 or a simpler markdown renderer. Do not proceed to Sprint 2 with a slow editor. |
| Existing note migration loses content for >1% of test notes | Sprint 1, any point | Stop migration rollout. Ship editor as opt-in only until migration is fixed. |
| Existing IPC integration tests fail after notes IPC additions | Any sprint | Revert notes IPC changes. Fix before merging. Zero tolerance for regressions in chat/source functionality. |
| Wiki hallucination rate >10% in controlled evaluation | Sprint 5, week 1 | Pause wiki feature. Invest in grounding pipeline improvements before proceeding. Consider reducing wiki to "draft" status with prominent disclaimers. |
| <5% of MVP users engage with formatted markdown features after 30 days | Post-MVP (Sprints 1-2) | The core hypothesis is wrong -- users do not want a better editor in DeepNote. Pause Sprints 3-6. Investigate whether the real need is something else entirely. |
| Graph view causes renderer crashes or >500MB memory usage at 300 nodes | Sprint 3 | Fall back to a list-based backlink/link explorer instead of force-directed graph. Revisit graph rendering approach. |
| User interviews show <2/5 interest in AI wiki concept | Pre-Sprint 5 validation | Reduce Sprint 5 scope to basic "AI summary per source" (1 week) instead of full wiki system (4 weeks). Redirect effort to canvas or workflow features. |

---

## Per-Sprint Validation

### Sprint 1: Editor Foundation (3 weeks)

**What to test:**
- Markdown rendering fidelity: every supported syntax element (H1-H6, bold, italic, code, lists, blockquotes, callouts, LaTeX, wiki links, tags)
- Round-trip integrity: note content survives save/reload without changes
- Migration: load every existing note in the test corpus; diff content before and after
- Performance: keystroke latency benchmark on synthetic large notes
- Wiki link autocomplete: response time with 200+ notes

**Acceptance criteria:**
- All existing notes render without data loss
- Keystroke latency <16ms P95 on 5K-word note with 10+ embeds
- Wiki link autocomplete <100ms with 200+ notes
- All callout types, LaTeX (inline + block), and code blocks with syntax highlighting render correctly
- Keyboard shortcuts (Cmd+B/I/K) work consistently

**Metrics to watch:**
- Keystroke latency distribution (P50, P95, P99)
- Memory usage of editor component vs. old textarea
- Note save/load cycle time

---

### Sprint 2: Organization & Search (2 weeks)

**What to test:**
- Folder CRUD: create, rename, delete, nest 3+ levels, drag-and-drop reorder
- Folder operations with undo support
- FTS5 search: accuracy, speed, snippet relevance
- Quick switcher: fuzzy matching quality and speed
- Outline panel: updates live on heading changes

**Acceptance criteria:**
- Full-text search returns results in <200ms across 500 notes
- Quick switcher matches on partial titles with typo tolerance (Levenshtein distance 2)
- Outline panel updates within 500ms of heading addition/removal
- Folder drag-and-drop works without data loss; undo restores previous state
- Bookmarked notes persist across app restarts

**Metrics to watch:**
- Search query latency distribution
- Notes per user (baseline vs. post-ship, target 3x in 60 days)
- Quick switcher usage frequency (proxy for "users have enough notes to need it")

---

### Sprint 3: Knowledge Graph (2 weeks)

**What to test:**
- Graph rendering: fps at 100, 300, 500 nodes
- Web Worker layout computation: no main-thread blocking
- Backlink panel: correctness and update latency after note save
- Unlinked mention detection: precision and recall on a labeled test corpus
- Graph filters: tag filter, date range, orphan toggle

**Acceptance criteria:**
- 500 nodes + 2000 edges at 60fps pan/zoom on mid-range hardware
- Backlink panel updates within 500ms of saving a note with new links
- Unlinked mention false positive rate <5% on test corpus
- Graph filter interactions <100ms
- Click-to-navigate from graph node to note works reliably

**Metrics to watch:**
- Graph view open rate (target: 40% of weekly active users)
- Mean time spent in graph view per session
- Unlinked mention "Link" action acceptance rate (quality signal)

---

### Sprint 4: Workflows (3 weeks)

**What to test:**
- Daily note auto-creation with correct date and template resolution
- Template variable substitution ({{date}}, {{day}}, {{title}}, {{previous_daily}})
- Weekend gap handling for {{previous_daily}}
- Task checkbox bidirectional sync: check in daily note, verify update in source note
- Task index query performance with 500+ notes
- Timezone edge cases (user works past midnight)

**Acceptance criteria:**
- Daily note auto-creates on app open with correct date and fully resolved template
- Checking a task in aggregated view updates source note within 1 second
- Task query across 500 notes completes in <300ms
- {{previous_daily}} correctly skips weekends and gaps
- Templates with all supported variables resolve without errors

**Metrics to watch:**
- Daily note creation rate (% of days the user opens the app)
- Template usage frequency
- Task completion rate (tasks checked off vs. created)

---

### Sprint 5: Knowledge Wiki (4 weeks)

**What to test:**
- Ingest pipeline: PDF -> concept extraction -> wiki page generation
- Incremental enrichment: second source on overlapping topic enriches, does not duplicate
- Source attribution: every claim has a clickable citation
- Contradiction detection: two sources with conflicting quantitative claims
- Query-wiki-first: chat answers from wiki when topic is covered
- Human-edit protection: user edits survive subsequent AI ingests
- Provider comparison: run identical ingest across all 4 providers

**Acceptance criteria:**
- 40-page PDF generates 5-15 wiki pages within 60 seconds
- Second overlapping source enriches existing pages (zero duplicates on test set)
- 100% of wiki claims have clickable source citations
- Contradiction detected when two sources disagree on a quantitative claim (tested with 3 planted contradictions)
- Wiki-first chat query answers in <2s (vs. ~5s RAG baseline)
- User edits persist through 3 subsequent source ingests

**Metrics to watch:**
- Wiki page generation success rate (% of ingests that produce pages)
- Hallucination rate (manual audit of 50 random claims per week)
- Wiki-first hit rate (target: 40% of queries on covered topics)
- User edit rate on wiki pages (target: 30% of users with wiki pages)

---

### Sprint 6: Canvas + AI-Native (4 weeks)

**What to test:**
- Canvas rendering: fps with 50, 100, 150 nodes
- Memory usage over extended canvas sessions (2+ hours)
- Drag-and-drop from sidebar to canvas
- Inline editing: double-click to edit, changes sync to source note
- Arrow creation and persistence across app restart
- AI auto-tag suggestion relevance
- "Summarize Selection" grounding quality
- Canvas state save/restore integrity

**Acceptance criteria:**
- 100 nodes at 60fps pan/zoom
- Memory usage <500MB after 2 hours of canvas use
- Drag-and-drop works on first attempt, every time
- Inline edits sync to source note within 1 second
- Canvas state fully restores after app restart (node positions, arrows, groups)
- Auto-tag acceptance rate >70% in internal testing
- "Summarize Selection" output cites only the selected nodes (no hallucinated external info)

**Metrics to watch:**
- Canvas creation rate
- Average nodes per canvas
- Auto-tag acceptance vs. dismissal rate
- "Summarize Selection" usage frequency
- Memory growth rate during canvas sessions

---

## Post-MVP Validation

### User Behavior to Track (Sprints 1-2 shipped)

| Behavior | Metric | Signal |
|----------|--------|--------|
| Editor adoption | % of users using any formatting (headings, bold, code, links) | >80% in 30 days = proceed; <50% = investigate |
| Note volume | Average notes per user, pre vs. post upgrade | 3x increase in 60 days = on track |
| Wiki link usage | Average wiki links per note | >2 links/note average = linking behavior established |
| Search usage | Quick switcher / full-text search invocations per session | Rising usage = users have enough notes to need search |
| Session duration | Time spent in notes vs. chat vs. sources | Shift toward notes = notes are becoming the work surface |
| Return rate | 30-day retention (8+ active days out of 30) | 25% increase vs. baseline = stickiness improving |

### Feedback Channels

1. **In-app feedback button** on the notes panel (post-MVP). Simple thumbs up/down + optional text. Low friction.
2. **5 user interviews** at MVP+2 weeks and MVP+4 weeks. Focus on: what do you use, what is missing, what is broken, would you stop using Obsidian/Notion now?
3. **GitHub issues / Discord** for bug reports and feature requests from early adopters.
4. **Local telemetry** (opt-in): feature usage counts, performance metrics, error rates. No content collection.

### Decision Points for Proceeding to Sprint 3+

| Timeframe | Decision | Go Criteria | No-Go Criteria |
|-----------|----------|-------------|-----------------|
| MVP + 2 weeks | Start Sprint 3 (Graph) | >60% editor adoption; no critical bugs; positive interview signal | <40% editor adoption; critical perf issues unfixed; users say "I still use Obsidian for notes" |
| MVP + 4 weeks | Start Sprint 4 (Workflows) | Graph view used by >25% of users; search usage growing; note volume trending toward 3x | Graph view ignored (<10% open rate); note volume flat; users not creating enough notes to need workflows |
| Pre-Sprint 5 | Commit to Knowledge Wiki (4-week investment) | User interviews confirm wiki interest (4/5+); provider quality eval passes (>3.5 avg); hallucination rate <5% in controlled test | <2/5 interview interest; any provider below 2.5 quality; hallucination >10% |
| Pre-Sprint 6 | Commit to Canvas + AI-Native | Wiki adoption >30% of users with sources; no critical wiki bugs; canvas demand validated in interviews | Wiki unused; users prefer raw RAG over wiki answers; no expressed demand for canvas |

---

*This plan is a living document. Update confidence levels and evidence columns as validation results come in. Kill criteria are non-negotiable -- if a threshold is hit, the specified action is mandatory, not optional.*
