---
id: '113'
title: BDD skill file updates — reduce ceremony, increase agent judgment
type: feature
phase: done
status: done
created: 2026-04-11
parent: '109'
---

## Goal

Update 4 BDD skill files + 2 supporting skill files + 1 template to reduce ceremony and increase agent judgment. Text changes only — no hook code, no enforcement logic.

## Changes

### SCENARIOS.md (Phase 3-4)

- Add to Phase 3 step 1: "Draw from resolved questions during understanding to determine which behavioral space to cover."
- Add after step 2: "Focus on key behaviors — happy path, critical edge cases, error cases. Avoid testing implementation details."
- Phase 4: Add Independence criterion (AODI). Keep as separate phase (research supports blind-spot gap).

### DECOMPOSITION.md (Phase 5)

- Add optional note at entry: "Optional — skip if architecture is clear from converged proposal."
- Replace fixed ordering (data → logic → API → UI → E2E) with: "Order tasks so each builds on what's already working. Avoid building layers that depend on unfinished layers."
- Soften test layer assignment: "Prefer the highest scope that covers the behavior with acceptable feedback speed."

### TDD.md (Phase 6)

- RED: Simplify 6→3 steps. Remove front-loading of testing skill/guide. Add tautological test red flag. (TDAD: verbose TDD prompts increase regressions.)
- GREEN: Add over-implementation warning. Keep 5 steps.
- REFACTOR: Merge 6.3+6.4 into one section. Conditional /refactor invocation (small changes directly, structural changes via skill).
- Remove "Entering implementation" announcement (stale #100 pattern).
- Soften outside-in ordering: "highest scope with acceptable feedback speed."

### DONE.md (Phase 7)

- Reorganize 7 steps → 2 sections (Finish/Close) with ordered sub-steps.
- Remove BDD Compliance Self-Check (self-reporting unreliable).
- Trim flake detection to one line.
- Add regression check note to cross-scenario refactoring.

### testing/SKILL.md + refactor/SKILL.md

- Remove "Load the testing skill" front-loading instructions (context rot).
- Add "with acceptable feedback speed" to scope preference for consistency.

### test-definitions-feature.md (template)

- Simplify ~120 lines → lean Given/When/Then + RED/GREEN/REFACTOR checkboxes per scenario.

## Research basis

See `.safeword-project/learnings/agent-behavior-research.md`

## Work Log

- 2026-04-11T23:17Z Created: Extracted from #109 epic (Group 3 + Group 4)
