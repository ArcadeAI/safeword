# Test Definitions: Cross-agent adversarial reviews

Feature source: `packages/cli/features/cross-agent-adversarial-reviews.feature`

test-definitions.md is the R/G/R ledger. Executable Given/When/Then behavior lives in the feature source.

## Rule: cross-agent-review.TBU1.R1 — Available class-1 reviews use the opposite agent

### Scenario Outline: Each author agent selects the opposite headless reviewer

- [x] RED ddb235b15
- [x] GREEN 012896828
- [x] REFACTOR 1ab101c1c

### Scenario: A same-agent candidate cannot displace an available opposite reviewer

- [x] RED skip: route policy shipped in the preceding walking-skeleton loop; regression proof fails if the same-agent candidate is selected
- [x] GREEN cb453b649
- [x] REFACTOR skip: the shared oppositeReviewer policy already expresses the rule without duplication

### Scenario: An author outside the Claude and Codex pairing keeps its existing route

- [x] RED 32083119d
- [x] GREEN 268905524
- [x] REFACTOR skip: the existing-route branch is already the minimal explicit policy outcome

## Rule: cross-agent-review.TBU1.R2 — Review evidence names the actual agents and independence level

### Scenario: A validated opposite-agent result earns complete provenance

- [x] RED 1d281517b
- [x] GREEN 6c23a4d5f
- [x] REFACTOR skip: model assignment remains centralized beside the runtime argument contract

### Scenario Outline: Reviewer identity faults earn no review evidence

- [x] RED c8fca35b0
- [x] GREEN 6d22461d7
- [x] REFACTOR skip: the two identity classifications share one focused validation function

## Rule: cross-agent-review.TBU1.R3 — The reviewer is isolated from writes and unrelated credentials

### Scenario: A reviewer write attempt cannot alter the judged work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unrelated author-vendor credential never enters the reviewer boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cross-agent-review.TBU2.R1 — Preferred-route failures are classified before fallback

### Scenario Outline: Each preferred-route failure keeps its specific cause

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cross-agent-review.TBU2.R2 — Fallback evidence never overstates independence

### Scenario: A permitted host-native fallback is recorded as degraded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A degraded fallback cannot satisfy hard cross-agent enforcement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cross-agent-review.TBU2.R3 — Exhausting safe routes blocks with recovery guidance

### Scenario: No safe review route blocks without hanging or minting evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cross-agent-review.NTB1.R1 — The outcome plainly states whether an independent agent checked the work

### Scenario Outline: Every outcome leads with its independence status

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An opaque technical status is not accepted as the builder-facing result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cross-agent-review.NTB1.R2 — A degraded or blocked outcome leads with one recommended recovery action

### Scenario Outline: The builder receives one actionable recovery step for each failure

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cross-agent-review.SWM1.R1 — Every class-1 surface uses one coordinator contract

### Scenario Outline: Each class-1 surface enters the shared coordinator

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A class-1 surface that bypasses the coordinator fails parity validation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cross-agent-review.SWM1.R2 — Opposite-agent behavior is consistent across desktop and cloud

### Scenario Outline: Existing desktop or cloud authentication can run the opposite reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A cloud session never invents or exposes a missing reviewer credential

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An explicit opt-out retains the existing route without cross-agent evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An explicit opt-out cannot satisfy hard cross-agent enforcement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: cross-agent-review.SWM1.R3 — Non-class-1 work retains its existing routing

### Scenario Outline: Excluded reviewer classes do not enter the cross-agent coordinator

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
