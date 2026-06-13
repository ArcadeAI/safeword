---
id: 006
type: feature
phase: done
status: done
parent: 001
created: 2026-01-06T14:38:00Z
last_modified: 2026-01-06T15:10:00Z
---

# Phase-Aware Quality Review

**Goal:** Quality review hook provides context-appropriate prompts based on current BDD phase.

**Why:** Generic "double check your work" prompts waste time. Phase-specific prompts catch phase-appropriate issues.

**Parent Epic:** [001-stateful-bdd-flow](001-stateful-bdd-flow.md) (Iteration 5)

## Current State

Implementation exists (was done as shortcut in Story 12). Now formalizing with proper BDD:

- `lib/quality.ts` - 6 phase-specific prompts
- `stop-quality.ts` - Reads phase from most recent ticket, shows prompt
- Existing tests in `hooks.test.ts` cover JSON parsing, NOT phase detection

## What's Missing

- BDD scenarios documenting expected behavior
- Test coverage for phase detection logic
- Edge case handling (see Discovery below)

## Discovery Findings

**Edge cases identified:**

| Edge Case                                    | Decision                                                        |
| -------------------------------------------- | --------------------------------------------------------------- |
| No `phase:` field in ticket                  | Fall back to `implement` (safe default)                         |
| Unknown phase value (e.g., `phase: garbage`) | Fall back to `implement`                                        |
| Multiple tickets with same `last_modified`   | Arbitrary winner (rare, acceptable)                             |
| Future ticket created while working          | **Fix needed:** Filter to `status: in_progress` only            |
| Empty issues directory                       | Fall back to `implement`                                        |
| Epic tickets (`type: epic`)                  | **Fix needed:** Skip `type: epic`, only consider features/tasks |

**Scope of changes:**

1. Update `getCurrentPhase()` to filter by `status: in_progress`
2. Update `getCurrentPhase()` to skip `type: epic` tickets
3. Add test coverage for phase detection logic

## Work Log

---

- 2026-01-06T15:10:00Z Complete: All 10 scenarios passing. Status/epic filtering implemented.
- 2026-01-06T15:00:00Z Phase 6: Starting implementation. TDD for getCurrentPhase() filtering.
- 2026-01-06T14:48:00Z Phase 3: Scenarios defined (10). Moving to scenario-gate.
- 2026-01-06T14:45:00Z Phase 2: Discovery complete. Moving to define-behavior.
- 2026-01-06T14:38:00Z Created: Ticket for Iteration 5 (split from epic 001)
- 2026-01-06T14:35:00Z Phase 0: Starting discovery

---
