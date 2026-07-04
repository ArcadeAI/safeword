# Test Definitions: retro auto-trigger (Claude-first)

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

Feature source: `packages/cli/features/retro-auto-trigger.feature`

test-definitions.md is the R/G/R ledger.

## Rule: The substance gate discriminates real work from trivial sessions (SM1.AC1, SM1.AC2)

### Scenario Outline: The substance decision flips at the threshold (inclusive)

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Fires once on a substantial session (SM1.AC1)

### Scenario: A substantial session surfaces one nudge carrying the path and guide

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Stays silent on a trivial session (SM1.AC2)

### Scenario: A session the gate judges trivial surfaces no nudge

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Never nudges twice in one session (SM1.AC3)

### Scenario: A second Stop for the same session stays silent because the sentinel is set

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A different session id still nudges (the sentinel is keyed by session id)

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Runs while the session is alive, cloud-safe (SM1.AC4)

### Scenario Outline: The session id resolves by precedence (input > cloud > local)

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: The hook reads the supplied transcript path and never guesses one

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: The nudge is a fact, not a command (TB1.AC1)

### Scenario: The surfaced nudge contains no imperative command to the agent

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: The hook never breaks the turn (TB1.AC2)

### Scenario Outline: A malformed or unreadable input fails open

- [x] RED
- [x] GREEN
- [x] REFACTOR
