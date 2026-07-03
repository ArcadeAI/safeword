# Test Definitions: Feature Files as Source

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

Feature source: `packages/cli/features/feature-files-as-source.feature`

`test-definitions.md` is the R/G/R ledger for this ticket. The executable
Given/When/Then scenarios live in the feature source above.

## Rule: Feature tags drive coverage and generated tests

### Scenario: check reads feature tags before markdown scenario titles

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: codify emits Vitest from feature source

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: codify expands Scenario Outline rows from feature source

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: check reports invalid feature syntax without parser stack

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Legacy markdown remains a fallback

### Scenario: markdown-only tickets still codify

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Authoring instructions name feature files as source

### Scenario: bdd and review instructions point at feature source

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at verify-phase: either `<sha>` (the refactor commit) or `skip: <non-empty reason>`.

- [ ] cross-scenario
