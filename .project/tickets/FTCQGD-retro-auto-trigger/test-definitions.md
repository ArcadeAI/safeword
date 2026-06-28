# Test Definitions: retro auto-trigger (Claude-first)

Feature source: `packages/cli/features/retro-auto-trigger.feature`

test-definitions.md is the R/G/R ledger.

## Rule: The substance gate discriminates real work from trivial sessions (SM1.AC1, SM1.AC2)

### Scenario Outline: The substance decision flips at the threshold (inclusive)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Fires once on a substantial session (SM1.AC1)

### Scenario: A substantial session surfaces one nudge carrying the path and guide

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Stays silent on a trivial session (SM1.AC2)

### Scenario: A session the gate judges trivial surfaces no nudge

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Never nudges twice in one session (SM1.AC3)

### Scenario: A second Stop for the same session stays silent because the sentinel is set

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A different session id still nudges (the sentinel is keyed by session id)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Runs while the session is alive, cloud-safe (SM1.AC4)

### Scenario Outline: The session id resolves by precedence (input > cloud > local)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The hook reads the supplied transcript path and never guesses one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The nudge is a fact, not a command (TB1.AC1)

### Scenario: The surfaced nudge contains no imperative command to the agent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The hook never breaks the turn (TB1.AC2)

### Scenario Outline: A malformed or unreadable input fails open

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
