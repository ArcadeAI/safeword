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

| Guide                      | Lines | Verdict     | Action                                                     | Ticket    |
| -------------------------- | ----- | ----------- | ---------------------------------------------------------- | --------- |
| cli-reference.md           | 43    | REMOVE      | Inline decision table into SAFEWORD.md                     | **#112h** |
| llm-writing-guide.md       | 184   | UPDATE      | Add 2026 Anthropic research, fix emphasis/recency claims   | **#112g** |
| learning-extraction.md     | 526   | TRIM HARD   | Same content repeated 4×, cut ~400 lines                   | **#112a** |
| context-files-guide.md     | 454   | TRIM        | ~40% restates Claude Code docs                             | **#112f** |
| testing-guide.md           | 409   | DEDUPLICATE | ~80% overlap with testing SKILL.md, separate concerns      | **#112c** |
| architecture-guide.md      | 392   | TRIM        | Cut restatements, keep layers & boundaries                 | **#112e** |
| zombie-process-cleanup.md  | 285   | TRIM        | Fix broken xref, cut ~30%                                  | **#112d** |
| planning-guide.md          | 417   | TRIM        | Cut Part 2 (~190 lines duplicating template/testing-guide) | **#112b** |
| design-doc-guide.md        | 181   | KEEP        | No changes needed                                          | —         |
| data-architecture-guide.md | 210   | KEEP        | Minor: add schema auto-gen acknowledgment                  | —         |

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
- 2026-04-11T23:10 Audit complete. Read all 10 guides, all cross-referencing skills/templates, and researched Claude Code native capabilities + latest Anthropic research. Verdicts captured. Applied learnings discoverability convention (one-line "Covers:" summary) to all existing learnings files.
- 2026-04-11T23:50 Cleaned up parent ticket — collapsed per-guide findings into verdicts table with child ticket refs. Details live in #112a–#112h.
