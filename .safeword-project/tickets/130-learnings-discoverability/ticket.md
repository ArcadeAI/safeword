---
id: 130
type: feature
phase: implement
status: in_progress
created: 2026-04-15T14:10:00Z
last_modified: 2026-04-17T17:05:00Z
---

# Improve learnings discoverability for Claude Code agents

**Goal:** Make the `.safeword-project/learnings/` folder self-discoverable via Claude Code's native Agent Skills mechanism, so relevant learnings auto-surface when the agent's task overlaps with recorded topics — with zero "check when stuck" conditional-recall instructions.

**Why:** Hard-won project lessons sit in `.safeword-project/learnings/` but aren't being used. Current mechanism (SAFEWORD.md line "check FIRST when stuck") is a conditional-recall instruction that decays after long sessions (per Anthropic context-engineering research and the "Lost in the Middle" literature). Even when the agent does check, it faces cryptic filenames with no cheap way to tell which files are relevant. Learnings exist; learnings aren't read; mistakes repeat.

## Design

### Mechanism

Use **one auto-generated umbrella skill** at `.claude/skills/project-learnings/SKILL.md` that wraps whatever happens to live in `.safeword-project/learnings/` for this specific project. This matches Anthropic's documented [Pattern 2: Domain-specific organization](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) (cf. the `bigquery-skill` reference example).

**Why umbrella and not per-learning skills:** per-learning would burn a skill directory per file and clutter the slash menu; Anthropic's own multi-domain-reference pattern is a single skill with a body index pointing at per-topic files.

### The generated skill

```yaml
---
name: project-learnings
description: Project-specific engineering lessons recorded during this codebase's
  development. Topics: <topic1>, <topic2>, ..., <topicN>. Read the matching file
  before related work to avoid re-making previously-solved mistakes.
user-invocable: false
---

# Project Learnings

Match your current task to a topic, then read the specific file:

- <topic1> → .safeword-project/learnings/<file1>.md
- <topic2> → .safeword-project/learnings/<file2>.md
- ...
```

- `user-invocable: false` — hidden from `/` menu (Anthropic's documented pattern for "background knowledge" skills)
- Body stays tiny; actual learning content loads only when the agent reads the pointed-to file (progressive disclosure step 3)
- Description carries the topic keywords so Claude's auto-invocation picks the skill when tasks overlap

### Auto-generation

A CLI command `safeword sync-learnings` reads each `.md` file in `.safeword-project/learnings/`, extracts the `Covers:` line (line 3), and regenerates `.claude/skills/project-learnings/SKILL.md`. Deterministic string extraction — no AI, no fuzzy matching.

Hooks invoke the command at three points:

| Event                                                                           | Fires on                          | Purpose                                                  |
| ------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| `PostToolUse` (Edit/Write/MultiEdit matcher `.safeword-project/learnings/*.md`) | Agent edits a learning in-session | Keep skill current within the session                    |
| `SessionStart`                                                                  | Any new Claude Code session       | Catch out-of-band edits (git pull, external editor)      |
| Pre-commit                                                                      | `git commit`                      | Drift-proof: regenerate + auto-stage before commit lands |

Claude Code's built-in `.claude/skills/` watcher hot-reloads the skill within the current session once regenerated — no restart needed.

### Covers: convention

Every learning file MUST have `Covers: <topic list>` on line 3. This is the existing convention for most files and the extraction guide already teaches it.

- `safeword sync-learnings` is **lenient**: skips non-conforming files with an stderr warning, so edits never block
- `safeword audit` (via the audit skill) gains a check that flags learning files lacking `Covers:`

### SAFEWORD.md cleanup

Delete the `Location: .safeword-project/learnings/ — check FIRST when stuck, debugging 2+ times, ...` line in `.safeword/SAFEWORD.md` and its template mirror. The skill system replaces it structurally. Keep the pointer to `learning-extraction.md` (the writing guide — a deliberate workflow, not conditional recall).

## Acceptance Criteria

- [ ] `.claude/skills/project-learnings/SKILL.md` is generated from `.safeword-project/learnings/*.md` contents
- [ ] `safeword sync-learnings` CLI command exists and is covered by unit tests (happy path, missing Covers:, deletions, idempotency)
- [ ] PostToolUse hook fires `safeword sync-learnings` on Edit/Write of `.safeword-project/learnings/*.md`
- [ ] SessionStart hook fires `safeword sync-learnings` (safe no-op when nothing changed)
- [ ] Pre-commit hook regenerates the skill and auto-stages changes
- [ ] Templates ship all of the above: `packages/cli/templates/hooks/` and `packages/cli/templates/skills/project-learnings/` are in sync with dogfooded versions
- [ ] `safeword audit` flags learning files missing the `Covers:` convention
- [ ] All 16 learning files have `Covers:` on line 3 (5 currently non-conforming: `claude4-examples-override-rules.md`, `claude4-prose-over-lists.md`, `instruction-attention-hierarchy.md`, `natural-vs-self-report-gates.md`, `procedural-gates-generalize-beyond-tdd.md`)
- [ ] SAFEWORD.md + template: "check FIRST when stuck" conditional-recall line removed
- [ ] Full test suite passes
- [ ] Dogfood verification: editing a learning in this repo regenerates the skill file via the hook

### Not doing (with justifications)

- **Split `llm-coding-agents-linting.md` (584 lines)** — cohesive; loads on demand via learning file read. Attention budget only bites if always-loaded; it isn't.
- **Merge `post-tool-linting-strategies.md` into hook patterns** — different topics (hook retry loops vs ESLint architecture). Both stay; both discoverable via Covers: index.
- **Condense `e2e-test-zombie-processes.md` to ~50 lines** — the pkill/lsof/playwright snippets are directly actionable; stripping them removes working code.
- **Rename `agent-behavior-research.md` / `claude4-prose-over-lists.md`** — filenames become irrelevant once Covers: is the index; renames would break in-file cross-references.
- **`head -3` convention in SAFEWORD.md** — still conditional recall. Deleted, not repurposed.
- **Per-learning skills** (one SKILL.md per learning file) — creates FS clutter and menu noise; Anthropic's documented pattern is umbrella + domain-file references.
- **`.claude/rules/` directory** — originally proposed in brainstorm; Claude Code does not recognize this path (it's a Cursor convention). Replaced by the native Agent Skill.
- **Promote content to MEMORY.md** — existing one-line pointers are sufficient; adding more bloats the always-loaded context budget.

## Work Log

- 2026-04-17T17:05:00Z Design rewrite: Original brainstorm design referenced `.claude/rules/` (does not exist in Claude Code) and `head -3` discovery (still conditional recall). Researched Anthropic Agent Skills docs, Karpathy LLM Wiki pattern, and progressive disclosure best practices. Converged on one umbrella `project-learnings` skill auto-generated from Covers: lines via `safeword sync-learnings`, fired by PostToolUse + SessionStart + pre-commit hooks. Content reorg (splits, renames, condensation) dropped as bloat — attention budget argument doesn't apply when files load on demand. Reclassified task → small feature (new hook + CLI + audit integration).
- 2026-04-16T16:04:00Z Cross-ref: Ticket #126 added novelResearchReminder flag — fires on any .safeword-project/learnings/\*.md creation/edit. During 130's bulk file operations, this will fire repeatedly. Expected and harmless — flag is idempotent (set true N times, one reminder).
- 2026-04-15T14:10:00Z Created: From brainstorm session. Initial design had mechanism errors (see 2026-04-17 rewrite).
