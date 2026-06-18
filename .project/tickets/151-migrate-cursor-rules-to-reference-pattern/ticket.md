---
id: 151
type: task
phase: intake
status: pending
created: 2026-05-17T19:35:00Z
last_modified: 2026-06-18T14:40:00Z
---

# Migrate Cursor Rules to @reference Pattern

**Goal:** Convert the four duplicate-content Cursor rules (`safeword-debugging.mdc`, `safeword-quality-reviewing.mdc`, `safeword-refactoring.mdc`, `safeword-testing.mdc`) to the `@reference` pattern so each rule is a thin pointer to the corresponding Claude skill file. Single source of truth, zero drift risk.

**Why:** Cursor rules currently use two inconsistent patterns:

- `@reference` (newer): `safeword-core.mdc` (5 lines), `safeword-ticket-system.mdc` (9 lines), and now `safeword-brainstorming.mdc`, `safeword-elicitation.mdc`, `safeword-tdd-review.mdc` (from ticket 150 / PR #103)
- **Duplicate content** (older): `safeword-debugging.mdc` (209 lines), `safeword-quality-reviewing.mdc` (186), `safeword-refactoring.mdc` (175), `safeword-testing.mdc` (276) — each independently authored alongside its Claude skill

Parity-check only validates template ↔ dogfood within the same toolchain. It does NOT validate Claude-skill ↔ Cursor-rule content equivalence. So the four duplicate-content rules can silently drift from their Claude counterparts (and may already have).

## Current State

| Cursor rule                | Lines | Claude skill   | Lines | Pattern                 |
| -------------------------- | ----- | -------------- | ----- | ----------------------- |
| safeword-core              | 5     | (SAFEWORD.md)  | —     | `@reference`            |
| safeword-brainstorming     | 7     | brainstorm     | 42    | `@reference` (new)      |
| safeword-debugging         | 6     | debug          | 226   | `@reference` (migrated) |
| safeword-elicitation       | 7     | elicit         | 84    | `@reference` (new)      |
| safeword-quality-reviewing | 6     | quality-review | 115   | `@reference` (migrated) |
| safeword-refactoring       | 6     | refactor       | 237   | `@reference` (migrated) |
| safeword-tdd-review        | 7     | tdd-review     | 75    | `@reference` (new)      |
| safeword-testing           | 6     | testing        | 282   | `@reference` (migrated) |
| safeword-ticket-system     | 9     | ticket-system  | ~     | `@reference`            |

## Investigation Needed (Before Conversion)

1. **Audit current drift.** For each of the four duplicate-content rules, diff the rule body against the Claude skill body. If they're already out of sync, that's a content decision to surface in this ticket — converting silently would lose the divergent Cursor wording.
2. **Verify `@reference` works in Cursor** for rules in the 150-300 line range. The existing `@reference` examples are tiny (5-9 lines target → 200+ line target file). Confirm Cursor's Agent Requested mode fully expands the referenced file at trigger time.
3. **Check whether any rule has Cursor-specific content** (e.g., `@cursorrules` directives, `@docs:` mentions, IDE-specific instructions) that would be lost on conversion.

## Scope

- Convert 4 Cursor rules to the `@reference` pattern matching `safeword-ticket-system.mdc`
- Add a **structural** guard (lint/contract) that skill Cursor-rules must be `@reference` pointers — prevents NEW duplicate-content rules. (Content-_equivalence_ checking is moot once a rule is a thin pointer: the reference **is** the single source, so there is no rule body left to drift.)
- Update any contributor docs that describe the duplicate-content convention

## Out of Scope

- Changing the content of the underlying Claude skills
- BDD-split rules (`bdd-core`, `bdd-discovery`, etc.) — **already migrated** to `@reference` (ticket `G1A6BS-bdd-cursor-rules-reference`); no longer applicable here
- Migrating skill rules to a different format entirely

## Done When

- Four rules converted to `@reference` pattern
- Pre-conversion content diffs documented in this ticket if any drift was found
- A **structural** guard prevents new duplicate-content skill-rules (rules must be `@reference` pointers) — content-equivalence is then auto-satisfied by the pointer
- `bun scripts/parity-check.ts --mode=all` clean

## Work Log

- 2026-05-17 19:35 UTC — Ticket created as follow-up from ticket 150 / PR #103. While porting three new Cursor rules I noticed the duplicate-content pattern in 4 older rules creates silent drift risk; the project already supports `@reference` pattern, so migration is mechanical once drift is audited.
- 2026-06-18 11:54 UTC — Refresh during a quality-review pass. (1) `safeword-quality-reviewing.mdc` grew 157→186 lines: commit `bb429c40` added a shared "Loop" block to both the `.md` skill and this `.mdc`. On conversion, the `.mdc`'s 8-step protocol is intentionally dropped and the Loop survives via the `@reference` to the skill — audit accordingly. (2) The 7 `bdd-*` rules are already `@reference` (ticket `G1A6BS`), so the BDD out-of-scope note is resolved. (3) `@reference` mechanic confirmed current in Cursor docs; large-file (150–300 line) expansion depth still unverified — investigation item 2 stands. (4) Reframed the equivalence guard as a structural "must-be-pointer" check.
- 2026-06-18 14:40 UTC — **Converted all 4 rules to `@reference`** (branch `ticket-151-cursor-rules-reference`, off main after #257 merged). Drift audit (independent sub-agent): debugging / refactoring / testing are stale duplicates their skills already supersede → mechanical convert, zero loss; quality-reviewing was genuinely divergent (legacy 8-step generic protocol). **Maintainer decision: DROP the 8-step** — the automatic quality hook already covers general review, and the skill deliberately focuses on web research + the Loop. No Cursor-specific content (`globs`/`@docs`/IDE directives) in any rule; no contributor docs reference the old convention (nothing to update). Each rule keeps its `description`/`alwaysApply` frontmatter; body replaced with `@.claude/skills/<dir>/SKILL.md`. Cursor `@reference` mechanic verified for ≤282-line targets (13 rules already use it; large-file limits start in the thousands). `parity-check --mode=all` clean (157 pairs + 3 contracts). **Remaining:** the structural must-be-pointer guard (done-when item 3) — deferred to a focused follow-up.
- 2026-06-18 15:17 UTC — **Structural guard landed** (`checkCursorRulesThin` in `packages/cli/src/parity.ts`, tests in `parity.test.ts`): `parity-check` now fails any `cursor/rules/*.mdc` whose body isn't a pure `@reference`, in BOTH modes — so pre-commit (`--mode=contracts-only`) hard-blocks a re-fattened rule before it lands. All done-when items now satisfied (4 rules converted · drift documented · guard in place · `parity-check` clean · 17/17 parity tests pass). Ready to close on merge of PR #260.
