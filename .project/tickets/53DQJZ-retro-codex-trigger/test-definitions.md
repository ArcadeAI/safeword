# Test Definitions: retro auto-trigger — Codex

Feature source: `packages/cli/features/retro-codex-trigger.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Counts Codex tool events, not Claude tool_use (SM1.AC1)

### Scenario Outline: Codex rollout events count as tool use only when they are tool events

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed rollout line is skipped, not counted or thrown

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The Codex substance decision flips at the threshold (SM1.AC1, SM1.AC2)

### Scenario Outline: A Codex rollout is substantial at or above the threshold (inclusive)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Fires once on a substantial Codex session via a continuation (SM1.AC2)

### Scenario: A substantial Codex session emits a block-continuation with path and guide

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A Codex rollout below the threshold is judged trivial and emits no block

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A rollout of Claude-shaped tool_use lines counts zero Codex tool events and does not fire

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Idempotent and cloud-safe, reusing the shared core (SM1.AC3)

### Scenario: A second Stop for the same Codex session does not continue again

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A different Codex session id still fires (sentinel keyed by session id)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The Codex session id resolves from the payload or environment

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Fails open with valid JSON, never breaking the Codex turn (TB1.AC1)

### Scenario Outline: A malformed or unreadable input fails open with valid JSON

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The Claude path is unchanged by the counter refactor (TB1.AC2)

### Scenario: The Claude counter still counts Claude tool_use after the seam refactor

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
