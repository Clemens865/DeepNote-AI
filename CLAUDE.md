# Claude Code Configuration - Claude Flow V3

## Behavioral Rules (Always Enforced)

- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- NEVER save working files, text/mds, or tests to the root folder
- Never continuously check status after spawning a swarm — wait for results
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files

## File Organization

- NEVER save to root folder — use the directories below
- Use `/src` for source code files
- Use `/tests` for test files
- Use `/docs` for documentation and markdown files
- Use `/config` for configuration files
- Use `/scripts` for utility scripts
- Use `/examples` for example code

## Project Architecture

- Follow Domain-Driven Design with bounded contexts
- Keep files under 500 lines
- Use typed interfaces for all public APIs
- Prefer TDD London School (mock-first) for new code
- Use event sourcing for state changes
- Ensure input validation at system boundaries

### Project Config

- **Topology**: hierarchical-mesh
- **Max Agents**: 15
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

## Build & Test

```bash
# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

- ALWAYS run tests after making code changes
- ALWAYS verify build succeeds before committing

## Security Rules

- NEVER hardcode API keys, secrets, or credentials in source files
- NEVER commit .env files or any file containing secrets
- Always validate user input at system boundaries
- Always sanitize file paths to prevent directory traversal
- Run `npx @claude-flow/cli@latest security scan` after security-related changes

## Concurrency: 1 MESSAGE = ALL RELATED OPERATIONS

- All operations MUST be concurrent/parallel in a single message
- Use Claude Code's Task tool for spawning agents, not just MCP
- ALWAYS batch ALL todos in ONE TodoWrite call (5-10+ minimum)
- ALWAYS spawn ALL agents in ONE message with full instructions via Task tool
- ALWAYS batch ALL file reads/writes/edits in ONE message
- ALWAYS batch ALL Bash commands in ONE message

## Swarm Orchestration

- MUST initialize the swarm using CLI tools when starting complex tasks
- MUST spawn concurrent agents using Claude Code's Task tool
- Never use CLI tools alone for execution — Task tool agents do the actual work
- MUST call CLI tools AND Task tool in ONE message for complex work

### 3-Tier Model Routing (ADR-026)

| Tier | Handler | Latency | Cost | Use Cases |
|------|---------|---------|------|-----------|
| **1** | Agent Booster (WASM) | <1ms | $0 | Simple transforms (var→const, add types) — Skip LLM |
| **2** | Haiku | ~500ms | $0.0002 | Simple tasks, low complexity (<30%) |
| **3** | Sonnet/Opus | 2-5s | $0.003-0.015 | Complex reasoning, architecture, security (>30%) |

- Always check for `[AGENT_BOOSTER_AVAILABLE]` or `[TASK_MODEL_RECOMMENDATION]` before spawning agents
- Use Edit tool directly when `[AGENT_BOOSTER_AVAILABLE]`

## Swarm Configuration & Anti-Drift

- ALWAYS use hierarchical topology for coding swarms
- Keep maxAgents at 6-8 for tight coordination
- Use specialized strategy for clear role boundaries
- Use `raft` consensus for hive-mind (leader maintains authoritative state)
- Run frequent checkpoints via `post-task` hooks
- Keep shared memory namespace for all agents

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

## Swarm Execution Rules

- ALWAYS use `run_in_background: true` for all agent Task calls
- ALWAYS put ALL agent Task calls in ONE message for parallel execution
- After spawning, STOP — do NOT add more tool calls or check status
- Never poll TaskOutput or check swarm status — trust agents to return
- When agent results arrive, review ALL results before proceeding

## V3 CLI Commands

### Core Commands

| Command | Subcommands | Description |
|---------|-------------|-------------|
| `init` | 4 | Project initialization |
| `agent` | 8 | Agent lifecycle management |
| `swarm` | 6 | Multi-agent swarm coordination |
| `memory` | 11 | AgentDB memory with HNSW search |
| `task` | 6 | Task creation and lifecycle |
| `session` | 7 | Session state management |
| `hooks` | 17 | Self-learning hooks + 12 workers |
| `hive-mind` | 6 | Byzantine fault-tolerant consensus |

### Quick CLI Examples

```bash
npx @claude-flow/cli@latest init --wizard
npx @claude-flow/cli@latest agent spawn -t coder --name my-coder
npx @claude-flow/cli@latest swarm init --v3-mode
npx @claude-flow/cli@latest memory search --query "authentication patterns"
npx @claude-flow/cli@latest doctor --fix
```

## Available Agents (60+ Types)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Specialized
`security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`

### GitHub & Repository
`pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`

## Memory Commands Reference

```bash
# Store (REQUIRED: --key, --value; OPTIONAL: --namespace, --ttl, --tags)
npx @claude-flow/cli@latest memory store --key "pattern-auth" --value "JWT with refresh" --namespace patterns

# Search (REQUIRED: --query; OPTIONAL: --namespace, --limit, --threshold)
npx @claude-flow/cli@latest memory search --query "authentication patterns"

# List (OPTIONAL: --namespace, --limit)
npx @claude-flow/cli@latest memory list --namespace patterns --limit 10

# Retrieve (REQUIRED: --key; OPTIONAL: --namespace)
npx @claude-flow/cli@latest memory retrieve --key "pattern-auth" --namespace patterns
```

## Quick Setup

```bash
claude mcp add claude-flow -- npx -y @claude-flow/cli@latest
npx @claude-flow/cli@latest daemon start
npx @claude-flow/cli@latest doctor --fix
```

## Claude Code vs CLI Tools

- Claude Code's Task tool handles ALL execution: agents, file ops, code generation, git
- CLI tools handle coordination via Bash: swarm init, memory, hooks, routing
- NEVER use CLI tools as a substitute for Task tool agents

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues

## Lazy Fetch (CLI Companion)

This project uses [lazy-fetch](https://github.com/Clemens865/Lazy-Fetch) for context, persistence, and process tracking.

### IMPORTANT: Automatic Behaviors

These actions are **required** — do them without being asked:

1. **Session start** → Call `lazy_read` to load git state, plan, and memory
2. **Before implementing any non-trivial task** → Call `lazy_contract` to define testable success criteria
3. **After every significant code change** → Call `lazy_check` to validate (includes typecheck, tests, security)
4. **After implementing against a contract** → Call `lazy_eval`, follow the QA instructions, then call `lazy_eval_record` with results
5. **When you make an architectural decision** → Call `lazy_remember` so it survives across sessions
6. **When you complete a task** → Call `lazy_done` to mark it and see what's next
7. **When memory is empty on first session** → Call `lazy scan` to bootstrap from the existing codebase (also discovers installed skills)

### Pattern Recognition — Auto-Select the Right Tool

When the user says something, **match their intent and act**:

| User says | You do (automatically) |
|-----------|----------------------|
| Reports a bug, error, crash | `lazy_blueprint_run` with `fix-bug` |
| Wants new functionality | `lazy_blueprint_run` with `add-feature` |
| Wants to try/explore something | `lazy_blueprint_run` with `experiment` |
| Wants a code review | `lazy_blueprint_run` with `review-code` |
| Describes a goal or project | `lazy_plan` to create phased tasks |
| Asks "where are we?" or "what's next?" | `lazy_status` then `lazy_next` |
| Asks about something stored | `lazy_recall` with the topic |
| Describes what they want to build (1-2 sentences) | `lazy_yolo_plan` with the idea → generates PRD → starts yolo |
| Provides a PRD file | `lazy_yolo_start` with the file path |
| Says "check" or "does it work?" | `lazy_check` then `lazy_eval` if contract exists |
| Asks about security | `lazy_secure` for full audit |
| Says "screenshot" or wants to see the UI | `lazy_doc_screenshot` with the URL |

### The Standard Implementation Loop

For every task, follow this loop:

```
1. lazy_gather <task>           ← understand what files matter
2. lazy_contract <task>         ← define what "done" means (testable criteria)
3. implement the work           ← write code
4. lazy_check                   ← typecheck + tests + security gate
5. lazy_eval → test → lazy_eval_record  ← skeptical QA against contract
6. if eval fails → fix → goto 4
7. lazy_done <task>             ← mark complete, see what's next
```

Skip step 2 (contract) only for trivial changes (typo fixes, config tweaks, one-line changes).

### Available Commands

| Command | When to use |
|---------|------------|
| `lazy plan <goal>` | Break a goal into phased tasks |
| `lazy plan --file <file>` | Import tasks from a bullet-point markdown file |
| `lazy status` | Check current plan progress |
| `lazy done <task or #>` | Mark a task complete |
| `lazy stuck <task or #>` | Mark a task as blocked |
| `lazy add <task>` | Add a task to the current plan |
| `lazy gather <task>` | Find relevant files before starting a task |
| `lazy check` | Validate: typecheck, tests, lint, security |
| `lazy contract <title>` | Generate testable success criteria |
| `lazy eval` | Evaluate work against contract (skeptical QA) |
| `lazy remember <key> <value>` | Store a decision or fact for future sessions |
| `lazy recall [key]` | Retrieve stored knowledge |
| `lazy journal <entry>` | Log a decision or milestone |
| `lazy scan` | Re-scan project: detect stack, commands, git history, TODOs, installed skills |
| `lazy skills` | Discover installed Claude Code skills for use in workflows |
| `lazy secure` | Full security audit: secrets, injection, auth, deps |
| `lazy doc` | Show documentation overview |
| `lazy doc screenshot <url>` | Capture a Playwright screenshot |
| `lazy yolo <prd-file>` | Autonomous mode: PRD → sprints → done |
| `lazy yolo report` | Run scorecard after yolo completion |
| `lazy yolo resume` | Resume paused/failed yolo session |
| `lazy selftest` | Verify lazy-fetch works correctly |

### Blueprints — Prefer These for Structured Tasks

Blueprints handle the full cycle: gather → checkpoint → implement → validate → remember. **Use them instead of ad-hoc implementation** when the task matches.

| Blueprint | Trigger keywords | Command |
|-----------|-----------------|---------|
| **fix-bug** | bug, broken, error, fix, crash, doesn't work, 500, fails | `lazy bp run fix-bug "<description>"` |
| **add-feature** | add, implement, build, create, new feature, support for | `lazy bp run add-feature "<description>"` |
| **experiment** | try, experiment, what if, explore, prototype, spike | `lazy bp run experiment "<description>"` |
| **review-code** | review, check my code, audit, look over, code quality | `lazy bp run review-code "<description>"` |

### Sprint Contracts & Evaluation

**Contracts define "done"** with testable criteria. **Evaluation tests against those criteria skeptically.**

The key insight (from Anthropic research): separating evaluation from generation produces better results than self-assessment. When you evaluate your own work, be a **skeptical QA tester**:
- Do NOT assume something works because the code looks correct
- Actually make HTTP requests, navigate pages, run commands
- A failing grade with specific feedback is more valuable than a false pass
- Use `lazy_doc_screenshot` to capture visual evidence for UI criteria

### Security

`lazy_check` includes a security gate automatically. For a full audit: `lazy_secure` (23 rules covering OWASP Top 10, secrets, deps).

In yolo mode, security gates run between sprints — blocking advancement on critical/high issues.

### Auto-Documentation

Generated automatically — no action needed:
- `docs/plan.md` — updates on every task change
- `docs/validation.md` — appends on every `lazy_check`
- `docs/sprints/` — sprint archives on completion (yolo mode)
- `docs/screenshots/` — Playwright captures

### MCP Tools

**The Loop:** `lazy_read`, `lazy_plan`, `lazy_plan_from_file`, `lazy_add`, `lazy_status`, `lazy_update`, `lazy_done`, `lazy_stuck`, `lazy_next`, `lazy_remove`, `lazy_reset_plan`, `lazy_check`

**Context:** `lazy_context`, `lazy_gather`, `lazy_watch`, `lazy_claudemd`

**Persist:** `lazy_remember`, `lazy_recall`, `lazy_journal`, `lazy_snapshot`

**Evaluate:** `lazy_contract`, `lazy_eval`, `lazy_eval_record`

**Documentation:** `lazy_doc`, `lazy_doc_screenshot`

**Security:** `lazy_secure`

**Blueprints:** `lazy_blueprint_list`, `lazy_blueprint_show`, `lazy_blueprint_run`

**Yolo:** `lazy_yolo_plan`, `lazy_yolo_start`, `lazy_yolo_status`, `lazy_yolo_advance`, `lazy_yolo_resume`, `lazy_yolo_report`

### Key Principles
- **Act, don't just suggest** — call the tool directly when you know it's the right one
- Run `lazy_read` at session start — always
- Use contracts before implementing — define "done" before you build
- Use `lazy_check` after every significant change — don't skip it
- Use `lazy_remember` for decisions that should survive across sessions
- Evaluate skeptically — test, don't assume
- **Check `.lazy/context/skills.json` for available skills** — use specialized skills (e.g., `/frontend-design` for UI, `/investigate` for debugging, `/api-database-scout` for API research) instead of doing everything generically
- Tell the user what you did and what's next — transparency builds trust
