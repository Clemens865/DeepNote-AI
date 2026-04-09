# DeepNote AI Notes Upgrade: User Journey Maps

## Document Purpose

Maps 5 core user scenarios for the Obsidian-class + AI Knowledge Wiki upgrade. Each scenario traces the full journey from trigger to resolution, identifying magic moments, edge cases, and design requirements.

---

## Scenario 1: Research & Note-Taking Flow

**Persona**: Maya, a PhD student researching climate policy. She has 12 PDF sources loaded and needs to synthesize arguments across them.

### Trigger

Maya highlights a passage in a source document and clicks "Take Note" (or presses the hotkey while reading a source).

### Current State (Before Upgrade)

1. Maya reads a source in the reader pane.
2. She switches to the notes panel -- a plain textarea.
3. She types freeform text, manually adding `#climate-policy` and `[[carbon-tax]]` by memory.
4. No formatting beyond plain text. No way to embed a chart, quote a block, or reference a specific passage.
5. She copies key figures into her note manually and hopes she remembers which source they came from.
6. Backlinks exist but only as flat text matches -- no structured graph.

### Desired State (With Upgrade)

1. Maya highlights a passage in the source. A floating toolbar offers: "Quote to Note", "Create Wiki Link", "Add to Daily Note".
2. She clicks "Quote to Note". The rich editor opens with the passage as a styled blockquote, auto-attributed with a source reference block: `> [!quote] Source: IPCC AR6 Ch.4, p.127`.
3. Below the quote, she types her analysis using live markdown preview -- bold for emphasis, a `$$` LaTeX block for the emissions formula, a mermaid diagram sketching the policy feedback loop.
4. She types `[[` and an autocomplete dropdown shows existing notes and wiki pages. She links to `[[carbon-tax]]` and `[[emissions-trading]]`. The editor suggests `[[Paris Agreement]]` as an unlinked mention it detected in her text.
5. She adds `#synthesis` and `#chapter-3` tags. The AI auto-tagger suggests `#policy-mechanism` based on content analysis.
6. She uses `![[emissions-chart-2024]]` to embed a chart from another note directly inline.
7. She presses `Cmd+S`. The note is saved, backlinks update instantly, and the knowledge graph gains new edges.

### Magic Moment

When Maya types `[[` and sees not just her own notes but AI-generated wiki pages from her sources -- pages she never wrote but that perfectly capture concepts she has been researching. She links to `[[carbon-border-adjustment]]` and realizes the AI wiki already synthesized three of her sources on this topic.

### Edge Cases

- **Conflicting source quotes**: Two sources claim different CO2 figures. The wiki lint system should flag the contradiction when both are linked to the same wiki page.
- **Large paste from PDF**: Pasting 2000 words of formatted text from a PDF should preserve structure (headings, lists) without breaking the editor.
- **Offline mode**: Rich editor must work fully offline; only AI features (auto-tag, auto-link suggestions) degrade gracefully.
- **Block reference to deleted note**: `![[deleted-note#section]]` should show a "Note not found" placeholder, not crash.
- **Rapid linking**: Creating 20+ wiki links in a single note should not cause lag in autocomplete or graph recalculation.

---

## Scenario 2: Knowledge Discovery via Graph View

**Persona**: David, a journalist investigating corporate lobbying networks. He has 40+ notes and 8 sources spanning two months of research.

### Trigger

David feels stuck. He has lots of notes but cannot see the big picture. He opens the Knowledge Graph view from the sidebar (or presses `Cmd+G`).

### Current State (Before Upgrade)

1. David can see backlinks on individual notes -- a flat list of "Notes that link here."
2. No visual graph. No way to see clusters, orphans, or unexpected connections.
3. He manually re-reads notes trying to find patterns.
4. He has no idea that three separate notes all mention the same lobbying firm under different aliases.

### Desired State (With Upgrade)

1. David opens the global graph. Nodes represent notes, wiki pages, sources, and tags. Edges represent `[[links]]`, backlinks, and AI-detected unlinked mentions.
2. He sees three distinct clusters: "Energy Sector", "Healthcare Lobbying", "Campaign Finance". A few bridge nodes connect them -- these are the interesting ones.
3. He clicks a bridge node: `[[Meridian Consulting]]`. The local graph expands showing all connections. He discovers that this firm appears in 6 notes across two clusters he thought were unrelated.
4. The "Unlinked Mentions" panel shows 4 notes that mention "Meridian" or "Meridian Group" without a wiki link. He clicks "Link" on each to formalize the connection.
5. He filters the graph by tag: only `#lobbying` nodes. The view simplifies. He filters by date range: only notes from the last 2 weeks. The recent research cluster becomes clear.
6. He right-clicks a cluster and selects "Summarize Cluster" -- the AI generates a paragraph summarizing the connected notes.
7. He drags an interesting subgraph into a new Canvas for spatial arrangement.

### Magic Moment

The unlinked mentions panel reveals that "Meridian Consulting", "Meridian Group", and "MG Associates" all refer to the same entity across 6 notes. David never made this connection manually. The graph view draws the implicit edges, and with one click he formalizes them into explicit links.

### Edge Cases

- **Graph with 500+ nodes**: Must remain performant. Use level-of-detail rendering -- collapse distant clusters, expand on zoom.
- **Orphan notes**: Notes with zero links should appear in a separate "Orphans" section, not clutter the main graph.
- **Circular references**: `A -> B -> C -> A` should render correctly without infinite loops in layout algorithms.
- **Unlinked mention false positives**: "Paris" the city vs. "Paris" the person. Need disambiguation UI -- "Link as [[Paris Agreement]]" vs. "Link as [[Paris Hilton]]" vs. "Ignore."
- **Graph view on small screen**: Must gracefully degrade on smaller Electron windows; offer a list-based fallback.

---

## Scenario 3: AI Knowledge Wiki Ingest

**Persona**: Kenji, a startup CTO doing competitive analysis. He just found a 45-page industry report PDF and wants to absorb it into his knowledge base quickly.

### Trigger

Kenji drags the PDF into DeepNote AI's source panel (or clicks "Add Source" and selects the file).

### Current State (Before Upgrade)

1. The PDF is added as a source. Kenji can read it in the reader pane.
2. He can chat with the AI about the PDF content.
3. To take notes, he manually reads, highlights, and writes notes in the plain textarea.
4. No automatic extraction of concepts, entities, or structured knowledge.
5. After an hour, he has 3 notes and feels like he barely scratched the surface.

### Desired State (With Upgrade)

1. Kenji drops the PDF. A progress indicator shows: "Ingesting source... Extracting concepts... Updating wiki..."
2. Within 30-60 seconds, the AI Knowledge Wiki engine:
   - Identifies 12 key concepts/entities from the report (e.g., `[[edge-computing]]`, `[[5G-infrastructure]]`, `[[competitor: Acme Corp]]`).
   - For each concept, checks if a wiki page already exists.
   - **Existing pages**: Updates them with new information from this source, citing the report. A diff-style "What changed" summary appears.
   - **New pages**: Creates wiki stubs with a summary, key facts, and source attribution.
3. Kenji sees a notification: "Wiki updated: 4 new pages, 8 pages enriched. 2 contradictions detected."
4. He clicks the contradictions alert. The wiki lint view shows:
   - `[[5G-latency]]`: This report claims <5ms; a previous source claimed <10ms. Both citations shown side-by-side with source links.
   - He resolves it: marks the newer report as authoritative, and the wiki page updates.
5. He opens `[[edge-computing]]` -- a wiki page he never wrote. It synthesizes information from this report and two previous sources, with clear attribution. He edits it to add his own analysis.
6. When Kenji later asks the AI a question, it queries the wiki first, giving grounded answers with citations rather than hallucinating.

### Magic Moment

Kenji opens the wiki page for `[[Acme Corp]]` and sees it already contains a competitor profile synthesized from three separate sources he added over the past month -- revenue figures from one report, product lineup from another, and now market positioning from today's PDF. He never wrote this page. The AI built it incrementally, and every claim links back to a specific source.

### Edge Cases

- **Duplicate concepts**: The report mentions "ML" and "machine learning" -- the wiki engine must merge these, not create separate pages.
- **Contradictions with no clear resolution**: Some contradictions are genuine (different years, different methodologies). The UI must support "acknowledged contradiction" status, not force a single truth.
- **Garbage-in**: A poorly OCR'd PDF produces garbled text. The ingest pipeline should detect low-confidence extraction and warn: "Source quality is low -- wiki updates may be unreliable."
- **Bulk ingest**: Kenji drops 10 PDFs at once. The system should queue them, process in parallel where possible, and show per-source progress.
- **Wiki page conflicts during concurrent ingest**: Two sources being ingested simultaneously both want to update `[[5G-infrastructure]]`. Need merge strategy, not last-write-wins.
- **User overrides**: If Kenji manually edits a wiki page, subsequent AI ingests should not overwrite his edits. AI-generated sections and human-written sections must be distinguishable.

---

## Scenario 4: Daily Knowledge Work

**Persona**: Priya, a product manager who uses DeepNote AI daily for market research and stakeholder management. She has been using the app for 3 months.

### Trigger

Priya opens DeepNote AI at 9:00 AM on a Monday morning.

### Current State (Before Upgrade)

1. The app opens to the last-viewed source or an empty state.
2. No sense of "today" -- no daily note, no task overview, no agenda.
3. She manually searches for notes she was working on Friday.
4. She has no templates; every meeting note starts from scratch.
5. Tasks are scattered across notes with no unified view.

### Desired State (With Upgrade)

1. The app opens to today's daily note: `2026-04-06 Monday`. It is auto-created from her daily note template:
   ```markdown
   # Monday, April 6, 2026

   ## Morning Review
   - [ ] Review tasks from [[2026-04-03 Friday]]
   - [ ] Check wiki updates from weekend ingests

   ## Tasks
   ![[tasks-inbox]]

   ## Meeting Notes
   <!-- New meetings go here -->

   ## End of Day
   - What did I learn today?
   - What's blocking me?
   ```
2. The "Tasks" section pulls in her open tasks from all notes via a dataview-style query. She sees:
   - `- [ ] Follow up with engineering on API spec` (from [[Meeting: Engineering Sync 2026-04-01]])
   - `- [ ] Review competitor pricing analysis` (from [[Competitive Analysis Q2]])
   - 3 more tasks, sorted by date created.
3. She clicks into `[[Meeting: Engineering Sync 2026-04-01]]` from the task link, reviews the context, then checks the task off. It updates everywhere.
4. At 10:00 AM she has a stakeholder meeting. She presses `Cmd+P` (command palette), types "new meeting", and selects her "Stakeholder Meeting" template. It pre-fills:
   ```markdown
   # Stakeholder Meeting: [Topic]
   **Date**: 2026-04-06
   **Attendees**:
   **Decisions**:
   **Action Items**:
   - [ ]
   ```
5. During the meeting she takes notes with rich formatting, links to wiki pages for context, and creates action items as tasks.
6. At end of day, she fills in her reflection in the daily note. The periodic notes view shows her weekly review is due Wednesday.

### Magic Moment

Priya opens the app and immediately sees her 5 open tasks pulled from across 12 different notes, right in her daily note. She checks off two, and the checkboxes update in the original notes simultaneously. She never has to hunt for forgotten tasks again.

### Edge Cases

- **No daily note template configured**: First-time experience should offer a template picker or generate a sensible default, not show a blank note.
- **Timezone handling**: Daily note date must respect local timezone, especially for users who work across midnight.
- **Task query performance**: Scanning all notes for `- [ ]` patterns could be slow with 500+ notes. Need an indexed task store.
- **Template variables**: Templates should support dynamic variables (`{{date}}`, `{{day}}`, `{{previous_daily}}`) that resolve on creation.
- **Weekend/gap handling**: If Priya skips Saturday and Sunday, Monday's daily note should link to Friday, not to nonexistent Saturday/Sunday notes.
- **Conflicting task states**: If a task checkbox is toggled in the daily note view, it must sync to the source note. Conflict resolution needed if both are edited simultaneously.

---

## Scenario 5: Canvas Planning

**Persona**: Rafa, a UX researcher synthesizing findings from 6 user interviews into a research report. He needs to see everything spatially before he can write linearly.

### Trigger

Rafa finishes reading his last interview transcript and feels overwhelmed by the volume of notes. He clicks "New Canvas" from the sidebar.

### Current State (Before Upgrade)

1. No canvas feature exists.
2. Rafa exports notes to sticky-note apps (Miro, FigJam) manually, losing all wiki links and backlinks.
3. He arranges physical index cards on his desk.
4. After spatial synthesis, he returns to DeepNote AI and manually writes the report, re-typing insights.

### Desired State (With Upgrade)

1. Rafa creates a new canvas: "Interview Synthesis Q2". An infinite, pannable workspace opens.
2. He drags 6 interview notes from the sidebar onto the canvas. Each appears as a card showing the note title and first few lines.
3. He double-clicks a card to expand it inline -- full rich editor right on the canvas. He highlights a key quote and changes its callout type to `[!insight]`.
4. He creates new floating text nodes directly on the canvas: "Theme: Onboarding Friction", "Theme: Pricing Confusion", "Theme: Feature Discovery". He color-codes them.
5. He draws arrows from interview cards to theme nodes, creating a visual affinity map. The arrows are labeled ("3 mentions", "critical pain point").
6. He drags a wiki page `[[user-onboarding]]` onto the canvas -- it shows the AI-synthesized wiki content inline.
7. He selects the "Onboarding Friction" cluster (theme node + 4 connected interview cards) and clicks "Summarize Selection." The AI generates a synthesis paragraph grounded in the selected cards.
8. He creates a new note directly from the canvas: "Research Report: Q2 User Interviews". The AI-generated summary becomes the starting point. He continues writing in the rich editor, embedding `![[canvas-screenshot]]` to include a snapshot of his spatial layout.
9. The canvas auto-saves. Links created on the canvas (arrows between notes) appear as backlinks in the regular note view and in the knowledge graph.

### Magic Moment

Rafa selects 4 interview cards and a theme node, clicks "Summarize Selection", and the AI produces a research insight grounded entirely in the selected sources -- not a generic summary but a synthesis that references specific quotes from specific interviews. He pastes it into his report and adds his own interpretation. The spatial layout made the pattern visible; the AI made it articulable.

### Edge Cases

- **Canvas with 100+ nodes**: Must maintain 60fps pan/zoom. Use virtualization -- only render visible nodes.
- **Bidirectional sync**: Editing a note on the canvas must update the note in the sidebar and vice versa. Need real-time sync, not snapshots.
- **Undo/redo on canvas**: Spatial operations (move, resize, connect) and content edits must be in a unified undo stack.
- **Canvas export**: Must support PNG/SVG export for embedding in external documents, plus PDF for printing.
- **Broken card references**: If a note on the canvas is deleted from the sidebar, the card should show a "Note deleted" state and offer to unlink or recreate.
- **Arrow semantics**: Canvas arrows are visual by default, but optionally create wiki links. Need clear UI to distinguish decorative arrows from semantic links.
- **Collaborative canvas (future)**: Even in single-user V1, data model should support multiple cursors for eventual collaboration.

---

## "A Day in the Life" Narrative

**Character**: Priya, product manager (Scenario 4 persona), but touching all 5 scenarios across her day.

---

### 7:45 AM -- Commute Reading (Mobile/Future, but Seeds Today's Work)

Priya reads an industry newsletter on her phone. She bookmarks three articles to ingest later.

### 9:00 AM -- Morning Kickoff (Scenario 4: Daily Knowledge Work)

She opens DeepNote AI. Today's daily note greets her with her template: morning review, open tasks, meeting slots. She scans 4 open tasks pulled from various notes. She checks off "Send API spec feedback" -- done Friday evening. Three remain.

She sees a notification badge: "2 wiki pages updated overnight." She clicks through. The `[[competitive-landscape]]` wiki page was enriched by a source she added Thursday -- new pricing data from a competitor's earnings call. She skims the diff and nods.

### 9:30 AM -- Source Ingest (Scenario 3: AI Knowledge Wiki Ingest)

She drags the three bookmarked articles (saved as PDFs) into the source panel. The ingest pipeline starts. While it processes, she reviews Friday's meeting notes.

A notification appears: "3 sources ingested. 2 new wiki pages: `[[API-first-strategy]]`, `[[developer-experience-metrics]]`. 5 pages enriched. 1 contradiction detected."

She opens the contradiction: the new article claims developer NPS benchmarks differ from a previous source. She reviews both citations side-by-side, marks the newer source as authoritative for this specific claim, and adds a note: "Methodology differs -- 2026 survey uses broader sample."

### 10:00 AM -- Stakeholder Meeting (Scenario 1: Research & Note-Taking)

She opens the command palette (`Cmd+P`), types "meeting", selects her Stakeholder Meeting template. It creates a new note pre-filled with today's date.

During the meeting, she takes notes in rich markdown -- bold for decisions, task checkboxes for action items, `[[wiki-links]]` to reference concepts. She quotes a stakeholder: `> [!important] "We need to ship the API by Q3 or we lose the enterprise deal."` She links this to `[[Q3-API-milestone]]`.

The AI auto-tagger suggests `#stakeholder-alignment` and `#api-priority`. She accepts both.

### 11:30 AM -- Knowledge Discovery (Scenario 2: Knowledge Graph)

After the meeting, she opens the knowledge graph. She filters by `#api-priority`. A cluster emerges connecting her meeting notes, the wiki page on `[[API-first-strategy]]` (from this morning's ingest), and three older research notes.

She spots an unlinked mention: an old note about "developer portal requirements" mentions API-first but was never linked. She formalizes the link. The graph redraws -- now she can see that the developer portal work from two months ago directly supports today's stakeholder ask. She was not aware of this alignment.

She clicks "Summarize Cluster" and gets a paragraph connecting the dots. She pastes it into a new note: `[[API Strategy Brief]]`.

### 2:00 PM -- Synthesis Session (Scenario 5: Canvas Planning)

Priya needs to prepare a strategy deck for the VP by Thursday. She creates a canvas: "Q3 API Strategy."

She drags onto it: the morning's `[[API Strategy Brief]]`, the wiki pages for `[[API-first-strategy]]` and `[[developer-experience-metrics]]`, three relevant meeting notes from the past month, and the `[[competitive-landscape]]` wiki page.

She arranges them spatially: competitor context on the left, internal stakeholder inputs in the middle, technical requirements on the right. She draws arrows showing dependencies. She creates theme nodes: "Revenue Impact", "Engineering Capacity", "Developer Adoption."

She selects the "Revenue Impact" cluster and clicks "Summarize Selection." The AI produces a grounded paragraph with citations. She does the same for the other two themes. She creates a new note from the canvas: `[[Q3 API Strategy Deck -- Draft]]` and starts writing, using the AI summaries as section seeds.

### 5:30 PM -- End of Day (Scenario 4: Daily Knowledge Work)

Back in her daily note, Priya fills in the reflection section:
```
## End of Day
- Learned: Our API-first work from Feb actually aligns with the new enterprise push. Graph view showed this.
- Blocking: Need engineering capacity estimates before Thursday.
- Tomorrow: Finish strategy deck draft, prep for Wednesday weekly review.
```

She creates tomorrow's daily note from template and adds a task: `- [ ] Get capacity estimates from [[Engineering Sync]] attendees`.

She closes the app. Everything is saved, indexed, and linked.

---

## Critical Path Analysis

### What MUST Work on Day One

**Priority 1 -- Non-Negotiable for Launch:**

| Component | Scenario | Rationale |
|-----------|----------|-----------|
| Rich Markdown Editor | S1 | Foundation for all other tiers. Without live preview, callouts, and code blocks, the upgrade feels cosmetic. Every note-taking action depends on this. |
| `[[Wiki Links]]` + Autocomplete | S1, S2 | The linking system is the connective tissue of the entire upgrade. Graph view, backlinks, unlinked mentions, and the AI wiki all depend on robust bidirectional linking. |
| AI Knowledge Wiki Ingest | S3 | This is the headline differentiator -- the Karpathy innovation. Without it, this is "Obsidian clone in Electron." With it, it is "the AI research tool." |
| Backlinks + Unlinked Mentions | S2 | Even without full graph visualization, textual backlinks and unlinked mention detection provide immediate discovery value. |

**Priority 2 -- Required Within 2 Weeks of Launch:**

| Component | Scenario | Rationale |
|-----------|----------|-----------|
| Knowledge Graph Visualization | S2 | Visual graph is the "wow" feature that sells the upgrade. Can ship as beta/experimental initially. |
| Daily Notes + Templates | S4 | Daily knowledge workers need this fast, but the plain editor still works for them at launch. |
| Command Palette + Quick Switcher | S4 | Power-user efficiency. Ship early but not gating. |
| Wiki Contradiction Detection | S3 | Important for trust in the AI wiki, but manual review works as interim. |

**Priority 3 -- Fast Follow (Month 1):**

| Component | Scenario | Rationale |
|-----------|----------|-----------|
| Canvas | S5 | High-value but independent feature. Users can use graph view as interim spatial tool. |
| Dataview Queries / Task Aggregation | S4 | Complex implementation. Manual task tracking works at launch. |
| AI Auto-Tag / Auto-Link | S7 | Enhancement layer on top of working manual system. |
| Periodic Notes / Kanban | S4 | Workflow refinements, not core. |

### The Critical Path (Dependency Chain)

```
Rich Editor (Tier 1)
    |
    v
Wiki Links + Backlinks (Tier 1 + Tier 3 partial)
    |
    v
AI Wiki Ingest Pipeline (Tier 6)
    |
    +---> Contradiction Detection (Tier 6)
    +---> Unlinked Mentions (Tier 3)
    |
    v
Knowledge Graph Visualization (Tier 3)
    |
    v
Daily Notes + Templates (Tier 4)
    |
    v
Canvas (Tier 5)
```

The editor is the foundation. Links are the connective tissue. The AI wiki is the differentiator. Everything else builds on these three.

### Launch Validation Criteria

Before shipping, these user stories must pass end-to-end:

1. **"I can write a note with markdown formatting and link to other notes"** -- Rich editor + wiki links work.
2. **"I can add a source and the AI creates/updates wiki pages"** -- Ingest pipeline works.
3. **"I can see which notes link to this note"** -- Backlinks work.
4. **"I can find notes I forgot about through unlinked mentions"** -- Discovery works.
5. **"I can ask the AI a question and it answers from my wiki, not from hallucination"** -- Query-wiki-first works.

If these five pass, the upgrade delivers its core promise: an AI-native knowledge system that gets smarter as you add sources.
