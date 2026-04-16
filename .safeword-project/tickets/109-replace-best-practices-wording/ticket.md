---
id: '109'
slug: replace-best-practices-wording
title: 'Replace "best practices" with "latest research" in quality prompts'
type: Patch
status: done
priority: low
last_modified: 2026-04-16T21:11:00Z
---

# Patch: Replace "best practices" with "latest research"

**Type:** Patch | **Priority:** Backlog

## Problem

Quality prompts across hooks, skills, templates, and docs reference "best practices" or "latest docs/best practices." This wording is vague and invites the agent to rely on static training data. "Latest research" is more specific — it signals the agent should actively verify against current documentation and real-world patterns, not recite memorized conventions.

## Change

Replace "best practices" with "latest research" (or "latest research and documentation") in **agent-facing prompt text** — the words that instruct LLMs what to check. Leave human-facing documentation headings and section titles alone (e.g., "## Best Practices" as a heading in a guide is fine — it's for humans, not agent prompts).

## Scope: Agent-Facing Prompts (CHANGE)

These are the lines that actively instruct an LLM what to verify:

### Quality hooks

- `.safeword/hooks/lib/quality.ts:75` — `"Does it follow latest docs/best practices?"`
- `packages/cli/templates/hooks/lib/quality.ts:75` — same (template source)

### Quality review skill

- `.claude/skills/quality-review/SKILL.md:26` — `"Testing patterns, BDD best practices"`
- `packages/cli/templates/skills/quality-review/SKILL.md:26` — same (template source)

### Cursor rules (agent-facing)

- `.cursor/rules/safeword-quality-reviewing.mdc:2` — description: `"...and best practices"`
- `.cursor/rules/safeword-quality-reviewing.mdc:10` — `"verify against current versions, documentation, and best practices"`
- `.cursor/rules/safeword-quality-reviewing.mdc:88` — `"Library best practices:"`
- `packages/cli/templates/cursor/rules/safeword-quality-reviewing.mdc` — same lines (template source)

### Audit skill

- `.claude/skills/audit/SKILL.md:158` — `"Best practices sources:"`
- `.cursor/commands/audit.md:156` — same
- `packages/cli/templates/commands/audit.md:156` — same (template source)
- `packages/cli/templates/skills/audit/SKILL.md:158` — same (template source)

### AGENTS.md (agent-facing description)

- `.safeword/AGENTS.md:3` — `"enforces best practices through hooks"`
- `packages/cli/templates/AGENTS.md:3` — same (template source)

### Website (user-facing but describes agent behavior)

- `packages/website/src/content/docs/reference/hooks-and-skills.mdx:16` — `"Deep review against latest best practices"`
- `packages/website/src/content/docs/reference/hooks-and-skills.mdx:67` — `"Check against current docs and best practices"`
- `packages/website/src/content/docs/reference/hooks-and-skills.mdx:135` — `"checks your code against current best practices"`

### Tests

- `packages/cli/tests/integration/hooks.test.ts:478` — asserts `'latest docs'` which remains unchanged (we're keeping "docs")
- No test changes needed unless a changed line is also covered by a test assertion

## Scope: Human-Facing Documentation (LEAVE ALONE)

These use "best practices" as section headings, titles, or human documentation — not as LLM instructions:

- `README.md` — product description (lines 7, 74, 101, 104, 216)
- `.safeword/guides/*.md` — section headings like `## Best Practices` (architecture-guide, data-architecture-guide, zombie-process-cleanup, hooks-authoring-guide, context-files-guide)
- `.safeword/templates/*.md` — `## Best Practices` section headings
- `packages/cli/templates/guides/*.md` — same (template sources)
- `packages/cli/src/presets/**/*.ts` — code comments describing ESLint configs
- `.safeword-project/guides/*.md` — internal guides
- `.safeword/guides/llm-writing-guide.md:44` — uses "best practices" as a BAD example (meta — leave it)
- `.safeword/guides/context-files-guide.md:136,185` — warns against "follow best practices" (meta — leave it)
- `.safeword/guides/learning-extraction.md` — references to Anthropic best practices doc (external link)

## Scope: Historical Records (LEAVE ALONE)

- `.safeword-project/tickets/` — all existing tickets are historical
- `.safeword-project/backlog/` — roadmap docs
- `.safeword-project/learnings/` — reference external Anthropic articles by title

## Part 2: Stop Hook Prompt Rewrite

The stop hook prompt (`.safeword/hooks/lib/quality.ts`, `implement` phase) gets a research-backed rewrite. Same files as Part 1 (quality.ts + template).

### Current (replace this)

```
SAFEWORD Quality Review:

Double check and critique your work again just in case.
Assume you've never seen it before.

- Is it correct?
- Is it elegant?
- Does it follow latest docs/best practices?
- If questions remain: research first, then ask targeted questions.
- Avoid bloat.
- If you asked a question above that's still relevant after review, re-ask it.
```

### New (replace with this)

```
SAFEWORD Quality Review:

Review your work critically.

- Is it correct?
- Could this be simplified without losing clarity?
- Does it follow latest docs and research? If unsure, say so — don't guess.
- If questions remain: research first, then ask targeted questions.
- Report findings only. No preamble.
- State what you're most uncertain about.
- If you asked a question above that's still relevant after review, re-ask it.
```

### Why each change

| Old                                                      | New                                                                         | Reason                                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| "Double check and critique your work again just in case" | "Review your work critically"                                               | Anthropic research: Opus 4.6 overtriggers on hedging language ("just in case", "again")                                                       |
| "Assume you've never seen it before"                     | (removed)                                                                   | Anchoring bias research (Springer 2025): telling LLMs to "forget" context is ineffective — tokens are in context regardless                   |
| "Is it elegant?"                                         | "Could this be simplified without losing clarity?"                          | "Elegant" is subjective and invites sycophancy. "Simplified" is measurable.                                                                   |
| "Does it follow latest docs/best practices?"             | "Does it follow latest docs and research? If unsure, say so — don't guess." | (1) "best practices" → "research" per Part 1. (2) Escalation clause: Anthropic docs recommend giving Claude permission to say "I don't know." |
| "Avoid bloat"                                            | "Report findings only. No preamble."                                        | Vague instructions produce vague compliance. Specific constraint.                                                                             |
| (none)                                                   | "State what you're most uncertain about."                                   | Metacognitive debiasing (arxiv 2507.10124): forcing uncertainty reflection is more effective than "assume fresh eyes."                        |

## Part 3: Quality Review Skill Provenance Labels

Add three-tier provenance labeling to the output format in `.claude/skills/quality-review/SKILL.md` and its template source `packages/cli/templates/skills/quality-review/SKILL.md`.

### Current output format (at end of code block)

```markdown
**Critical issues:** [List or "None"]
**Suggested improvements:** [List or "None"]
```

### New output format (append after Suggested improvements)

```markdown
**Critical issues:** [List or "None"]
**Suggested improvements:** [List or "None"]
**Provenance:** For version/API claims:

- (verified: [source URL or doc title]) — fetched this session
- (training data: may be outdated) — not verified
- (uncertain) — could not verify
```

### Why

Provenance labeling creates "epistemic friction" (Sendelbach, April 2026). The agent cannot write "(verified: npmjs.com)" without having actually fetched. When it writes "(training data: may be outdated)", the user knows to double-check. Three-tier (verified/training/uncertain) is more auditable than binary verified/unverified.

## Part 4: hooks.test.ts Lint Fixes (19 errors)

Fix all 19 pre-existing ESLint errors in `packages/cli/tests/integration/hooks.test.ts` without disabling any lint rules.

### Fix 1: Slow regex (1 error — `sonarjs/slow-regex`)

```typescript
// Old (line ~285):
expect(output).toMatch(/\w+, \w+ \d{1,2}, \d{4}/);
// New:
expect(output).toMatch(/[A-Za-z]+, [A-Za-z]+ \d{1,2}, \d{4}/);
```

### Fix 2: Replace execSync with fs APIs (4 errors — `sonarjs/os-command`)

In `setupIssuesDirectory` and `clearIssuesDirectory` helper functions:

```typescript
// Old:
execSync(`mkdir -p "${ticketsDirectory}"`, { cwd: targetDirectory });
execSync(`rm -rf "${ticketsDirectory}"/*`, { cwd: targetDirectory });
execSync(`mkdir -p "${targetDirectory}/${folderPath}"`, { cwd: targetDirectory });

// New:
import * as fs from 'node:fs';
fs.mkdirSync(ticketsDirectory, { recursive: true });
fs.rmSync(ticketsDirectory, { recursive: true, force: true });
fs.mkdirSync(folderPath, { recursive: true });
```

Use `nodePath.join()` for all path construction instead of string interpolation.

### Fix 3: `||` → `??` operators (3 errors — `strict-boolean-expressions`, `prefer-nullish-coalescing`)

In `runStopHook` helper (and `runStopHookForPhase` for `stderr`):

```typescript
// Old:
stdout: result.stdout || '',
stderr: result.stderr || '',
exitCode: result.status || 0,

// New:
stdout: result.stdout ?? '',
stderr: result.stderr ?? '',
exitCode: result.status ?? 0,
```

Also fix `result.stderr?.trim() ?? ''` → `(result.stderr ?? '').trim()` to resolve `no-unnecessary-condition`.

### Fix 4: Hardcoded `/tmp` path (1 error — `sonarjs/publicly-writable-directories`)

```typescript
// Old:
input: JSON.stringify({ transcript_path: '/tmp/fake.jsonl' }),
// New:
input: JSON.stringify({ transcript_path: nodePath.join(nonSafewordDirectory, 'fake.jsonl') }),
```

### Fix 5: Move 11 functions to module scope (11 errors — `unicorn/consistent-function-scoping`)

Move these functions from inside `describe` blocks to a `// Test helpers` section between the `afterAll` block and first `describe`:

1. `createTicketContent`
2. `setupIssuesDirectory`
3. `clearIssuesDirectory`
4. `createChangesTranscript`
5. `runStopHookForPhase`
6. `createMockTranscript`
7. `createMultiMessageTranscript`
8. `runStopHook`
9. `parseStopOutput`
10. `runLintHook` — add `targetDirectory: string` parameter (currently closes over `projectDirectory`), update all call sites
11. `runPostToolLint` — add `targetDirectory: string` parameter (same), update all call sites

Also add `import process from 'node:process'` since moving to module scope exposes stricter `no-undef` checks.

### Test assertion update

```typescript
// Old:
expect(output.reason).toContain("Assume you've never seen it before");
// New:
expect(output.reason).toContain('Review your work critically');
```

## Implementation

### Replacement patterns for Part 1 (best practices → research)

Only lines containing "best practices" change. Lines saying "latest docs" without "best practices" stay as-is.

- `"latest docs/best practices"` → `"latest docs and research"` (note: `and` not `/`)
- `"best practices"` in agent prompts → `"latest research"`
- `"BDD best practices"` → `"BDD research and patterns"`
- `"Library best practices:"` → `"Library research:"`
- `"enforces best practices"` → `"enforces quality standards"`
- `"current best practices"` → `"latest research"`
- `"and best practices"` → `"and latest research patterns"`

### Order of operations

1. Part 1: Find-and-replace "best practices" across ~10 files
2. Part 2: Rewrite stop hook prompt (same quality.ts files)
3. Part 3: Add provenance to quality-review SKILL.md
4. Part 4: Fix hooks.test.ts lint errors (19 errors → 0)
5. Run `bun test --run tests/integration/hooks.test.ts` — expect 49/49 pass
6. Run `bunx eslint tests/integration/hooks.test.ts` — expect 0 errors
