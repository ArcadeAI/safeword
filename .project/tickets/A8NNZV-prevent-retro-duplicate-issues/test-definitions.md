# Test Definitions: Prevent repeated retro findings from opening duplicate issues

The feature source is `packages/cli/features/prevent-retro-duplicate-issues.feature`.
These scenarios use focused Vitest coverage: draft construction and triage are
deterministic modules, while the REST transport test exercises exact GitHub body
search with only `fetch` mocked. Real command/spool/agent-path wiring is #1035's
separate scope.

## Rule: A canonical repro identity ignores model-assigned classification drift

### Scenario: New issue body preserves the legacy signature marker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: New issue body contains the exact canonical repro marker

- [x] RED 614da600
- [x] GREEN f2b18cf0
- [x] REFACTOR skip: marker construction stays a small pure helper beside the legacy marker

### Scenario: Same repro with altered title category and surface finds the canonical issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Exact compatibility precedes canonical lookup and does not merge near matches

### Scenario: Legacy signature match remains the first lookup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Canonical search rejects a body without the exact marker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Different canonical repro identity creates a new issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Canonical matches retain ordinary recurrence accounting

### Scenario: Canonical recurrence records once for a new session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Canonical recurrence is idempotent within a session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
