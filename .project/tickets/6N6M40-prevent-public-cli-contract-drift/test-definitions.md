# Test Definitions: Prevent public CLI contracts from drifting again

Feature source: `features/prevent-public-cli-contract-drift.feature`

This file is the RED/GREEN/REFACTOR progress ledger.

## Rule: cli-contract-drift.SWM1.R1 — Every production invocation has exactly one public, retained-alias, or internal catalog entry

### Scenario: The exhaustive catalog classifies every production invocation once

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Invalid invocation ownership is rejected with the route

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: cli-contract-drift.SWM1.R2 — One side-effect-free factory assembles the exact production Commander program and runCli remains the only argv boundary

### Scenario: The real production program is assembled without runtime effects

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: runCli applies rewrites and parses through the factory program

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Runtime registration drift is rejected

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Commander-owned options are derived from the assembled program

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: cli-contract-drift.SWM1.R3 — Retained aliases preserve supported behavior and reject options their handlers do not consume

### Scenario: Supported retained-alias behavior remains invocable

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An intentional redundant option remains explicit compatibility

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Removing or renaming a retained alias is rejected

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Irrelevant alias options fail before handler entry

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: cli-contract-drift.SWM1.R4 — Shipped surfaces fail one focused gate when stale

### Scenario: Every public command and argv rewrite has a shipped subprocess fixture

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Shipped fixture failures aggregate deterministically

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Each shipped surface detects independent drift

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Deprecated terminology is allowed only in compatibility regions

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Operative or malformed compatibility text is rejected

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: cli-contract-drift.SWM1.R5 — Ordinary pull requests cannot merge unless the stable CLI contract context passes against current main

### Scenario: The dedicated CLI contract job is stable and unconditional

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: The rollout observes the dedicated context before requiring it

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Unsatisfied contract results cannot permit an ordinary merge

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: The live main ruleset requires the exact context strictly

- [x] RED
- [x] GREEN
- [x] REFACTOR
