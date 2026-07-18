# Test Definitions: Prevent repeated retro findings from opening duplicate issues

The feature source is `packages/cli/features/prevent-retro-duplicate-issues.feature`.
These scenarios use focused Vitest coverage: draft construction and triage are
deterministic modules, while the REST transport test exercises exact GitHub body
search with only `fetch` mocked. Real command/spool/agent-path wiring is #1035's
separate scope.

## Rule: A canonical repro identity ignores model-assigned classification drift

### Scenario: New issue body preserves the legacy signature marker

- [x] RED skip: pre-existing compatibility behavior retained without a new failing case
- [x] GREEN skip: existing draft test already proves the legacy marker remains in new issue bodies
- [x] REFACTOR skip: no structural change required for retained behavior

### Scenario: New issue body contains the exact canonical repro marker

- [x] RED 614da600
- [x] GREEN f2b18cf0
- [x] REFACTOR skip: marker construction stays a small pure helper beside the legacy marker

### Scenario: Same repro with altered title category and surface finds the canonical issue

- [x] RED skip: regression was observed as a duplicate-creation path before canonical fallback existed
- [x] GREEN 01daf47d
- [x] REFACTOR skip: triage keeps the existing single known-issue path

## Rule: Exact compatibility precedes canonical lookup and does not merge near matches

### Scenario: Legacy signature match remains the first lookup

- [x] RED skip: existing signature lookup remained green; the regression test guards its ordering
- [x] GREEN 788a2649
- [x] REFACTOR skip: fallback stays a direct two-stage lookup

### Scenario: Canonical search rejects a body without the exact marker

- [x] RED skip: exact-filter regression was added alongside the transport implementation
- [x] GREEN 01daf47d
- [x] REFACTOR skip: shared marker construction avoids duplicate parsing rules

### Scenario: Different canonical repro identity creates a new issue

- [x] RED skip: existing genuinely-new-signature case extends through the canonical fallback
- [x] GREEN 01daf47d
- [x] REFACTOR skip: no additional branching required

## Rule: Canonical matches retain ordinary recurrence accounting

### Scenario: Canonical recurrence records once for a new session

- [x] RED skip: recurrence initially took the new-issue path before canonical fallback existed
- [x] GREEN 01daf47d
- [x] REFACTOR skip: reused the existing ledger recording function

### Scenario: Canonical recurrence is idempotent within a session

- [x] RED skip: idempotency behavior was already covered for signature matches
- [x] GREEN 8c87fcac
- [x] REFACTOR skip: no cross-scenario structural improvement needed

## Feature-level cross-scenario refactor

- [x] cross-scenario f8955ceb: whole-ticket review required exact marker matching, issue-only REST searches, and a mandatory canonical lookup contract; no further shared abstraction was warranted.
