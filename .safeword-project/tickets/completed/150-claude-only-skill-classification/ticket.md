---
id: 150
type: task
phase: intake
status: pending
created: 2026-05-17T18:55:00Z
last_modified: 2026-05-17T18:55:00Z
---

# Revisit "Claude-only" Skill Classification

**Goal:** Decide whether the `CLAUDE_ONLY_SKILLS` set (`brainstorm`, `tdd-review`, `elicit`) reflects a principled boundary or historical under-investment in Cursor parity. If principled, document the rule. If historical, add Cursor rules for the affected skills.

**Why:** While porting `elicit` from arcade-way, I classified it as Claude-only by matching the existing pattern, but did not interrogate whether the pattern itself is correct. The convention currently lives in two test files (`schema.test.ts`, `skills-commands-validation.test.ts`) with no written rationale.

## Current State

Three skills have no Cursor rule counterpart:

- `brainstorm` — divergent thinking partner
- `tdd-review` — quality check at TDD step transitions
- `elicit` — microquestion-based tacit knowledge extraction

All three trigger on **conversation state** (about-to-guess, about-to-converge, TDD-step-just-finished) rather than file context. Cursor rules trigger on `alwaysApply` or glob/description matching against files.

Every other safeword skill either:

- Has a Cursor rule (`debugging`, `quality-reviewing`, `refactoring`, `testing`, `ticket-system`, `bdd-*`), OR
- Is an action skill mapped to a Cursor command (`lint`, `verify`, `audit`, `cleanup-zombies`)

## Open Question

Is "conversation-state trigger" a sufficient reason to skip Cursor, or could these skills propagate to Cursor as `alwaysApply: true` discipline rules that Cursor's agent applies opportunistically?

## Investigation

- Read Cursor's latest rule-system docs (alwaysApply, agentRequested, manual modes)
- Check whether any Cursor rule in this repo uses pure conversation-state triggers
- Survey what `brainstorm` and `tdd-review` would look like as Cursor rules (concrete drafts)
- Decide: keep Claude-only (and document rationale in `schema.ts`) OR add Cursor rules for all three

## Scope

- Likely either:
  - Add a comment in `packages/cli/src/schema.ts` near the contextual-skills section explaining why these three are Claude-only, OR
  - Add `templates/cursor/rules/safeword-brainstorming.mdc`, `safeword-tdd-review.mdc`, `safeword-elicitation.mdc` + register pairs in `SAFEWORD_SCHEMA.ownedFiles` + update `SKILL_TO_RULE_MAP` and `CLAUDE_ONLY_SKILLS` in the two test files

## Out of Scope

- Changing what the three skills _do_ — only their distribution to Cursor
- Other skills' rule mappings (already settled)

## Done When

- Decision documented (either inline comment in `schema.ts` explaining Claude-only, or Cursor rules shipped and tests updated)
- `bun scripts/parity-check.ts --mode=all` clean
- `tests/schema.test.ts` and `tests/integration/skills-commands-validation.test.ts` green

## Work Log

- 2026-05-17 18:55 UTC — Ticket created as follow-up while porting `elicit` skill from arcade-way (commit pending). Original work shipped under current convention; this ticket interrogates whether the convention is right.
- 2026-05-17 19:20 UTC — Investigated [Cursor docs](https://cursor.com/docs/rules). Confirmed Agent Requested mode (`alwaysApply: false` + `description`) handles conversation-state triggers natively. Conclusion: Claude-only classification was historical drift, not principled. Resolved via the `@reference` pattern (precedent: `safeword-ticket-system.mdc`) rather than content duplication — three 7-line rules pointing at the Claude skill files. Eliminated `CLAUDE_ONLY_SKILLS` set entirely from `schema.test.ts`. Pair count: 94 → 97.
