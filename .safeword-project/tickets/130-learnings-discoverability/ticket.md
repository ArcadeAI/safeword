---
id: 130
type: task
phase: implement
status: in_progress
created: 2026-04-15T14:10:00Z
last_modified: 2026-04-15T14:10:00Z
---

# Improve learnings discoverability for Claude Code agents

**Goal:** Make learnings findable through structural mechanisms (path-triggered rules, live metadata) instead of relying on "check when stuck" instructions that degrade over long sessions.

**Why:** Research confirms conditional instructions ("check X when stuck") degrade after context compaction. 6 of 8 sampled principles are already baked into active system files — learnings are provenance, not primary knowledge. But when the agent does need them (ESLint config, hook authoring, debugging), the current `ls` + filename-guessing path has low hit rate for the 584-line and 156-line files.

## Design (from brainstorm session)

### Principles

- **No second source of truth** — pointer rules reference learnings, don't duplicate them
- **Drift-proof** — Covers: lines are the index, generated live via `head -3`
- **Natural gates > policy** — path-triggered rules auto-load structurally, not instructionally
- **Respect the attention budget** — decompose large files so loaded context is focused

### Changes

**1. SAFEWORD.md instruction update** (1 line)

- Change `ls .safeword-project/learnings/` to `head -3 .safeword-project/learnings/*.md`
- Covers: lines become the live discovery mechanism — no INDEX.md to maintain

**2. Pointer rules in `.claude/rules/`** (~5 lines each, 3-4 files)

- `eslint-guidance.md` — path: `eslint.config.*`, `packages/cli/src/presets/**` → points to learnings
- `hook-authoring.md` — path: `.safeword/hooks/**` → points to learnings
- `test-execution.md` — path: `packages/cli/tests/**` → points to learnings
- Each rule is a routing pointer, not a knowledge copy. Cannot drift.

**3. Decompose `llm-coding-agents-linting.md`** (584 lines → 3-4 focused files)

- `eslint-security-plugins.md` — security plugin analysis, config recommendations (~100 lines)
- `eslint-llm-failure-modes.md` — type system failures, what LLMs struggle with (~80 lines)
- `linting-research-2025.md` — research papers, benchmarks, provenance (~80 lines)
- `eslint-hook-patterns.md` — hook enforcement, exit codes, auto-fix loops (merge with `post-tool-linting-strategies.md`) (~60 lines)

**4. Condense `e2e-test-zombie-processes.md`** (228 lines → ~50 lines)

- Core lesson is ~30 lines. Rest is verbose examples repeating the same point.

**5. Standardize Covers: lines** (2 files)

- Add Covers: to `natural-vs-self-report-gates.md`
- Add Covers: to `claude4-examples-override-rules.md`

**6. Rename for task-matching** (2 files)

- `agent-behavior-research.md` → `enforcement-and-testing-principles.md`
- `claude4-prose-over-lists.md` → `concise-over-verbose-instructions.md`

### Not doing

- INDEX.md — replaced by live `head -3` convention. Zero maintenance, zero drift.
- Extracting content into rules — drift risk. Pointers only.
- Promoting more rules to MEMORY.md — existing one-liners are sufficient.
- Splitting `agent-behavior-research.md` — 156 lines, well-organized, cross-references are its value. Rename only.
- Converting learnings to skills — misuses the mechanism.
- Date-scoped file changes — `anthropic-research-feb-apr-2026.md` and `claude-code-changelog-feb-apr-2026.md` are archive, stay as-is.

## Acceptance Criteria

- [ ] SAFEWORD.md instruction uses `head -3` not `ls`
- [ ] SAFEWORD.md template in `packages/cli/templates/` also updated
- [ ] 3-4 pointer rules exist in `.claude/rules/` with correct path globs
- [ ] `llm-coding-agents-linting.md` split into 3-4 focused files, each with Covers: line
- [ ] `post-tool-linting-strategies.md` merged into hook patterns file
- [ ] `e2e-test-zombie-processes.md` condensed to ~50 lines
- [ ] All 15+ learning files have Covers: line on line 3
- [ ] 2 files renamed for task-matching
- [ ] No content duplication between rules and learnings
- [ ] Existing tests pass

## Work Log

- 2026-04-15T14:10:00Z Created: From brainstorm session exploring learnings discoverability options. Researched Anthropic context engineering guide, Claude Code rules/memory docs, Opus 4.6 context behavior. Debated 5 options (INDEX.md, rules extraction, decompose+rename, MEMORY.md promotion, skills conversion). Converged on pointer-rules + live-Covers + decomposition. Key insight: drift prevention via "no second source of truth" — rules point, don't duplicate.
