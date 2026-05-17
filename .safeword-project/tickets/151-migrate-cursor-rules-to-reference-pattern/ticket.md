---
id: 151
type: task
phase: intake
status: pending
created: 2026-05-17T19:35:00Z
last_modified: 2026-05-17T19:35:00Z
---

# Migrate Cursor Rules to @reference Pattern

**Goal:** Convert the four duplicate-content Cursor rules (`safeword-debugging.mdc`, `safeword-quality-reviewing.mdc`, `safeword-refactoring.mdc`, `safeword-testing.mdc`) to the `@reference` pattern so each rule is a thin pointer to the corresponding Claude skill file. Single source of truth, zero drift risk.

**Why:** Cursor rules currently use two inconsistent patterns:

- `@reference` (newer): `safeword-core.mdc` (5 lines), `safeword-ticket-system.mdc` (9 lines), and now `safeword-brainstorming.mdc`, `safeword-elicitation.mdc`, `safeword-tdd-review.mdc` (from ticket 150 / PR #103)
- **Duplicate content** (older): `safeword-debugging.mdc` (209 lines), `safeword-quality-reviewing.mdc` (157), `safeword-refactoring.mdc` (175), `safeword-testing.mdc` (276) — each independently authored alongside its Claude skill

Parity-check only validates template ↔ dogfood within the same toolchain. It does NOT validate Claude-skill ↔ Cursor-rule content equivalence. So the four duplicate-content rules can silently drift from their Claude counterparts (and may already have).

## Current State

| Cursor rule                | Lines | Claude skill   | Lines | Pattern            |
| -------------------------- | ----- | -------------- | ----- | ------------------ |
| safeword-core              | 5     | (SAFEWORD.md)  | —     | `@reference`       |
| safeword-brainstorming     | 7     | brainstorm     | 42    | `@reference` (new) |
| safeword-debugging         | 209   | debug          | 226   | duplicate          |
| safeword-elicitation       | 7     | elicit         | 84    | `@reference` (new) |
| safeword-quality-reviewing | 157   | quality-review | ~     | duplicate          |
| safeword-refactoring       | 175   | refactor       | ~     | duplicate          |
| safeword-tdd-review        | 7     | tdd-review     | 75    | `@reference` (new) |
| safeword-testing           | 276   | testing        | ~     | duplicate          |
| safeword-ticket-system     | 9     | ticket-system  | ~     | `@reference`       |

## Investigation Needed (Before Conversion)

1. **Audit current drift.** For each of the four duplicate-content rules, diff the rule body against the Claude skill body. If they're already out of sync, that's a content decision to surface in this ticket — converting silently would lose the divergent Cursor wording.
2. **Verify `@reference` works in Cursor** for rules in the 150-300 line range. The existing `@reference` examples are tiny (5-9 lines target → 200+ line target file). Confirm Cursor's Agent Requested mode fully expands the referenced file at trigger time.
3. **Check whether any rule has Cursor-specific content** (e.g., `@cursorrules` directives, `@docs:` mentions, IDE-specific instructions) that would be lost on conversion.

## Scope

- Convert 4 Cursor rules to the `@reference` pattern matching `safeword-ticket-system.mdc`
- Add a parity-check contract or test enforcing Claude-skill ↔ Cursor-rule content equivalence (so future divergence is caught)
- Update any contributor docs that describe the duplicate-content convention

## Out of Scope

- Changing the content of the underlying Claude skills
- Migrating BDD-split rules (`bdd-core`, `bdd-discovery`, etc.) — they reference phase-specific files inside the bdd skill folder; conversion is a separate question
- Migrating skill rules to a different format entirely

## Done When

- Four rules converted to `@reference` pattern
- Pre-conversion content diffs documented in this ticket if any drift was found
- A test or contract enforces Claude-skill ↔ Cursor-rule content equivalence going forward
- `bun scripts/parity-check.ts --mode=all` clean

## Work Log

- 2026-05-17 19:35 UTC — Ticket created as follow-up from ticket 150 / PR #103. While porting three new Cursor rules I noticed the duplicate-content pattern in 4 older rules creates silent drift risk; the project already supports `@reference` pattern, so migration is mechanical once drift is audited.
