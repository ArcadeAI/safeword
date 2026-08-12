# Test Definitions: Durable independent review

Feature source: `packages/cli/features/durable-independent-review.feature`

## Rule: finish-deep-reviews-in-background.TBU1.R1 — A healthy review outlives its foreground courtesy wait

### Scenario: A quick review returns its verdict inline

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A slow healthy review continues as a durable job

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A detached review can be collected after its caller exits

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: finish-deep-reviews-in-background.TBU1.R2 — A collected result is bound to the source it reviewed

### Scenario: Source changes make a completed review stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: finish-deep-reviews-in-background.TBU1.R3 — A builder can stop a review that is no longer useful

### Scenario: A running review is canceled explicitly

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
