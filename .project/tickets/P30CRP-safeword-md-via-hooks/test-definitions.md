# Test Definitions: Load SAFEWORD.md through safeword-owned hooks

Feature source: `features/safeword-md-via-hooks.feature`

test-definitions.md is the R/G/R ledger. Keep executable Given/When/Then
scenarios in the `.feature` file; keep only scenario progress here so hooks can
derive the active RED/GREEN/REFACTOR step.

## Rule: Setup preserves customer context files

### Scenario: Fresh setup does not create context files just to point at safeword

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Setup preserves existing customer context files

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Upgrade removes old safeword-managed context-file patches

### Scenario: Upgrade removes prior managed blocks without deleting customer content

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Supported agents receive SAFEWORD context from owned hook surfaces

### Scenario: Startup hooks are wired for Claude Cursor and Codex

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: SAFEWORD context hook emits agent-compatible context

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Claude compaction restores SAFEWORD context

### Scenario: Claude compact path re-injects SAFEWORD context

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at verify-phase: either `<sha>` (the refactor commit) or `skip: <non-empty reason>` (no shared fixtures or duplication emerged). The done-gate hard-blocks if this row is missing or has an empty skip reason on tickets that use the annotated checkbox format.

- [x] cross-scenario: focused shared helper added in `session-safeword-context.ts`; no further cross-scenario fixture extraction needed after the focused regression suite.
