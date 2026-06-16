# Test Definitions: Set an autonomy posture and resolve trusted decisions autonomously

Feature source: `features/autonomy-posture-spine.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature` source.

## Rule: Project policy sets the posture

### Scenario: A project preset is recorded in committed configuration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A preset resolves to an inspectable per-axis posture map

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Overriding one axis keeps the preset for the rest

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No policy defaults to Full review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: An invalid policy selection is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed policy fails safe to Full review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Personal policy overrides the project without touching the repo

### Scenario: Personal override takes precedence over the project policy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The personal override cannot be committed to the repository

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Without a personal override the project policy governs unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed personal override falls back to the project policy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: An autonomous axis resolves without pausing

### Scenario: An ask axis pauses for the human

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An autonomous axis is resolved without pausing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A resolution reflects the context the sub-agent was given

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An autonomous resolution is recorded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Autonomy degrades safely when it cannot decide

### Scenario: A transient figure-it-out failure is retried once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A repeated transient failure defers to the human

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An inconclusive verdict defers without retry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Some actions always stop for the human regardless of posture

### Scenario: A denylisted action prompts even under full autonomy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Hard gates still fire under autonomy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Closing a ticket as done needs explicit human confirmation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
