# Test Definitions: Deliver every eligible local retro finding in one bounded batch

Feature source: `features/deliver-local-retro-batches.feature`

test-definitions.md is the R/G/R ledger.

## Rule: deliver-local-retro-batches.SWM1.R1 — Every valid sanitized finding from one local session is recorded in original order as one bounded submission

### Scenario: Every local carrier submits multiple findings as one ordered batch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One finding uses the same batch contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid findings are excluded before a mixed batch leaves the project

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No valid findings make no public attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A request exactly at the shared byte limit is accepted whole

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An oversized request makes no partial public attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: deliver-local-retro-batches.SWM1.R2 — Released single-finding senders and new batch senders share one exact collector boundary without weakening raw-body duplicate authority

### Scenario: The shipped local batch crosses the real collector boundary unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Released v1 and exact v2 requests are both accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Byte-identical replay in one session scope reuses the durable receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Identical bytes in a different session scope receive a distinct receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unequal raw bytes in one session scope remain a conflict

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A v2 batch cannot replace a v1 submission in the same session scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid v2 envelopes are rejected before storage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector enforces the shared whole-request byte limit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: deliver-local-retro-batches.NTB1.R1 — Public acceptance failure timeout opt-out invalid input and oversize never block completion or consume private recovery

### Scenario: Public acceptance preserves private recovery silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Opt-out preserves private recovery silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Oversize preserves private recovery silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid input that leaves no valid findings stays silent and recoverable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Public collector outcomes preserve private recovery silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A collector timeout preserves private recovery silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
