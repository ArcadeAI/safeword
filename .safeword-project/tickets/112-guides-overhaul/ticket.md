---
id: 112
slug: guides-overhaul
status: in_progress
type: task
created: 2026-04-11
parent: '109'
children: '112a, 112b, 112c, 112d, 112e, 112f, 112g, 112h'
---

# Audit and overhaul CLI guides

**Goal:** Review all 10 guides for correctness, elegance, agent ergonomics, and duplication — ensure each earns its place and is effective at its stated intention.

## Context

- cli-reference.md found to be out of date (wrong flags, inconsistent syntax)
- cli-reference duplicates what `--help` already provides
- llm-writing-guide is the most cross-referenced guide (6 inbound links) — must be near-perfect
- No mechanism prevents guide drift from implementation
- Guides should complement (not duplicate) what's baked into Claude Code or elsewhere in safeword

## Audit criteria per guide

1. **Correct** — does content match current implementation?
2. **Elegant** — is it well-structured for its purpose?
3. **Effective** — does it achieve its stated intention?
4. **Non-duplicative** — does it add value beyond `--help`, Claude Code defaults, or other safeword files?
5. **Agent-ergonomic** — is it structured for LLM consumption (scannable, actionable, not prose-heavy)?

## Audit verdicts

| #   | Guide                      | Lines | Verdict     | Action                                                                |
| --- | -------------------------- | ----- | ----------- | --------------------------------------------------------------------- |
| 1   | cli-reference.md           | 43    | REMOVE      | Inline 6-row decision table into SAFEWORD.md                          |
| 2   | llm-writing-guide.md       | 184   | UPDATE      | Add latest Anthropic research, fill gaps (highest priority)           |
| 3   | learning-extraction.md     | 526   | TRIM HARD   | Cut from 526 to ~150-200 lines                                        |
| 4   | context-files-guide.md     | 454   | TRIM        | Remove content duplicated from Claude Code docs                       |
| 5   | testing-guide.md           | 409   | DEDUPLICATE | Separate concerns from testing SKILL.md                               |
| 6   | architecture-guide.md      | 392   | TRIM        | Cut verbose examples                                                  |
| 7   | zombie-process-cleanup.md  | 285   | TRIM        | Fix broken xref, cut ~30%                                             |
| 8   | planning-guide.md          | 417   | TRIM        | Cut Part 2 (test defs, ~190 lines duplicating template/testing-guide) |
| 9   | design-doc-guide.md        | 181   | KEEP        | No changes needed                                                     |
| 10  | data-architecture-guide.md | 210   | KEEP        | No changes needed                                                     |

## Per-guide findings

### 1. cli-reference.md — REMOVE

- Duplicates `bunx safeword --help` almost verbatim
- Already drifted: documented `-y, --yes` flags that are no-ops, inconsistent `@latest` usage
- Zero inbound cross-references from any other guide or skill
- Only unique content is 6-row "When to Use" decision table — belongs in SAFEWORD.md routing table
- No mechanism prevents future drift; `--help` is the single source of truth

### 2. llm-writing-guide.md — UPDATE (highest priority)

Most cross-referenced guide (6 inbound links). Foundation for all other guides. 184 lines, well-scoped.

**What's solid:**

- MECE decision trees
- Position-aware writing guidance
- Anti-patterns section
- Concrete examples over abstract rules

**Gaps vs latest Anthropic research (2026):**

- Missing: XML tag structure (`<instructions>`, `<context>`) — Anthropic explicitly recommends
- Missing: context quality degrades with token count — keep context lean and high-signal
- Missing: just-in-time retrieval principle (don't pre-load everything)
- Missing: few-shot example guidance (3-5 diverse canonical > exhaustive edge cases)
- Missing: long-context placement (20K+ docs at top, queries below)
- REMOVE if present: emphasis tokens ("IMPORTANT", "CRITICAL") — Anthropic 2026 guidance says newer models overtrigger on aggressive emphasis; use normal language instead
- "Recency bias" framing may be outdated — latest models handle long context better; position-awareness still relevant but mechanism evolved

### 3. learning-extraction.md — TRIM HARD

526 lines — longest guide by far. Core concept is valuable (implements Anthropic's just-in-time retrieval). But:

- Monthly review cadence, quarterly archiving, iteration sections read like process manual
- Agent doesn't need process management advice — needs: "When? What template? Where?"
- Target: ~150-200 lines covering recognition triggers, templates, location decision tree

### 4. context-files-guide.md — TRIM

454 lines. ~40% restates official Claude Code CLAUDE.md guidance:

- What to include/exclude (covered in Claude Code best practices)
- Line count guidance (covered officially)
- Modular structure with `@imports` (covered officially)

**Unique value to keep:**

- Safeword-specific trigger requirement (reference SAFEWORD.md at top)
- Cross-reference patterns to safeword artifacts
- Domain requirements section

### 5. testing-guide.md — DEDUPLICATE with testing SKILL.md

409 lines (guide) + 280 lines (skill) = ~690 lines teaching overlapping content:

- Both cover: test philosophy, behavior-biased testing, anti-patterns, test types, AAA pattern, quick-reference
- Claude Code natively advises "test behavior not implementation" and 80% coverage — some triple-covered

**Guide unique value:** E2E persistent dev server patterns, bug detection matrix, CI/CD integration
**Skill unique value:** Iron laws as enforceable rules, phase-aware triggering

Needs clear separation: skill = enforceable rules during workflow; guide = reference for patterns and strategies.

### 6. architecture-guide.md — TRIM

392 lines. Genuinely additive (layer boundaries, eslint-plugin-boundaries, dependency rules).

- "Worked example" re-evaluation path section is verbose
- Some overlap with data-architecture-guide on escalation criteria

### 7. zombie-process-cleanup.md — TRIM

285 lines. Fills a real Claude Code gap (zero built-in process management).

- Broken cross-reference to `development-workflow.md` on line 47 (file doesn't exist)
- Bisect scripts and tmux sections feel like reference material — trim ~30%

### 8. planning-guide.md — TRIM

417 lines. Part 1 (User Stories, lines 1-224) is genuinely additive — artifact levels, INVEST, story formats, acceptance criteria. Part 2 (Test Definitions, lines 226-417) is ~190 lines duplicating the test-definitions-feature template, testing-guide, and testing SKILL.md. If #109 simplifies test-definitions to Given/When/Then + checkboxes, Part 2 teaches an obsolete format.

- Cut Part 2 to a 5-line pointer to the template and testing-guide
- Trim user story examples (~55 lines) slightly
- Target: ~230 lines

### 9. design-doc-guide.md — KEEP

181 lines. Clean decision tree, good template integration, concise. No issues found.

### 10. data-architecture-guide.md — KEEP (minor improvement)

210 lines. Clean escalation from architecture-guide. Distinct concerns. Well-scoped, consistent What/Why/Document/Example format. No duplication with Claude Code (zero native data architecture guidance).

One minor improvement: add a 2-line note acknowledging schema auto-generation tools exist (Prisma generators, dbt YAML, Drizzle code-first). The guide's focus on business context (validation rules, source of truth, governance policies) is correctly what auto-gen can't provide — but not mentioning auto-gen at all looks like an oversight.

## Research sources

- Claude Code Best Practices: code.claude.com/docs/en/best-practices
- Anthropic Context Engineering: anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Claude Prompting Best Practices: platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Long Context Tips: docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips

## Execution order

1. **llm-writing-guide.md** — update first (foundation for all others)
2. **cli-reference.md** — remove, inline decision table into SAFEWORD.md
3. **learning-extraction.md** — trim hard (526 → ~150-200)
4. **context-files-guide.md** — trim duplicated Claude Code content
5. **testing-guide.md + SKILL.md** — deduplicate and separate concerns
6. **architecture-guide.md** — trim verbose sections
7. **zombie-process-cleanup.md** — fix broken xref, trim
8. **planning-guide.md** — minor trim

## Work Log

- 2026-04-11T22:58 Created ticket. cli-reference already patched (flags, @latest syntax).
- 2026-04-11T23:03 Started full audit of all 10 guides.
- 2026-04-11T23:10 Audit complete. Read all 10 guides, all cross-referencing skills/templates, and researched Claude Code native capabilities + latest Anthropic research. Verdicts captured.
