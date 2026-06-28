# Test Definitions: retro auto-trigger — Cursor

Feature source: `packages/cli/features/retro-cursor-trigger.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Reuses the Claude-shaped tool-use counter on the Cursor transcript (SM1.AC1)

### Scenario: The Claude-shaped counter counts tool_use blocks in a Cursor transcript

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: A Cursor transcript is substantial at or above the threshold (inclusive)

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Fires once on a substantial Cursor session via followup_message (SM1.AC1)

### Scenario: A substantial completed Cursor session emits a retro followup with path and guide

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A trivial completed Cursor session emits no retro followup

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Idempotent and cloud-safe, reusing the shared core (SM1.AC2)

### Scenario: The Cursor session id resolves from conversation_id

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An absent conversation id does not fire

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A second stop for the same Cursor session does not fire retro again

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A different conversation id still fires (sentinel keyed by session id)

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: The adapter reads the supplied transcript_path and never guesses one

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Coexists with the existing quality-review followup (SM1.AC3)

### Scenario: When the quality-review followup fires, retro yields without consuming its sentinel

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Retro fires on a later non-review stop after quality-review took an earlier one

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Fails open and respects non-completion (TB1.AC1)

### Scenario: A non-completed status emits no retro followup and leaves the sentinel unset

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: A malformed or unreadable input fails open

- [x] RED
- [x] GREEN
- [x] REFACTOR
