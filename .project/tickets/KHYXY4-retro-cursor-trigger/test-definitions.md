# Test Definitions: retro auto-trigger — Cursor

Feature source: `packages/cli/features/retro-cursor-trigger.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Reuses the Claude-shaped tool-use counter on the Cursor transcript (SM1.AC1)

### Scenario: The Claude-shaped counter counts tool_use blocks in a Cursor transcript

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A Cursor transcript is substantial at or above the threshold (inclusive)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Fires once on a substantial Cursor session via followup_message (SM1.AC1)

### Scenario: A substantial completed Cursor session emits a retro followup with path and guide

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A trivial completed Cursor session emits no retro followup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Idempotent and cloud-safe, reusing the shared core (SM1.AC2)

### Scenario: The Cursor session id resolves from conversation_id

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An absent conversation id does not fire

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A second stop for the same Cursor session does not fire retro again

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A different conversation id still fires (sentinel keyed by session id)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The adapter reads the supplied transcript_path and never guesses one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Coexists with the existing quality-review followup (SM1.AC3)

### Scenario: When the quality-review followup fires, retro yields without consuming its sentinel

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Retro fires on a later non-review stop after quality-review took an earlier one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Fails open and respects non-completion (TB1.AC1)

### Scenario: A non-completed status emits no retro followup and leaves the sentinel unset

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A malformed or unreadable input fails open

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
