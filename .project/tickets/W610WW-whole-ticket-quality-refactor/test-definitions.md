# Test Definitions: Whole-ticket quality review + refactor before verify

Feature source: `features/whole-ticket-quality-refactor.feature`

test-definitions.md is the R/G/R ledger. Keep executable Given/When/Then
scenarios in the `.feature` file; keep only scenario progress here so hooks can
derive the active RED/GREEN/REFACTOR step.

## Rule: The whole-ticket pass is required only above one loop

### Scenario: A single annotated loop is exempt despite the annotation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ticket with zero parsed scenarios needs no row

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Exactly two annotated loops require the cross-scenario row

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Exactly two annotated loops with a refactor commit pass

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A multi-scenario ticket with no annotations stays exempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A single-loop ticket with a present empty-skip row is still blocked

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A two-loop ticket with an empty skip reason is blocked

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A two-loop ticket with a real skip reason passes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Tasks and features share one validation path

### Scenario: A two-loop task is blocked by the same validator as a feature

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A two-loop task is blocked for a missing quality review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A single-loop task proceeds without a row

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The quality-review half is proven by its invocation log

### Scenario: A two-loop ticket without a logged quality review is blocked

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A two-loop ticket with a logged quality review passes the review check

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A single-loop ticket is not blocked for a missing quality review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at implement-exit: either `<sha>` (the refactor commit) or `skip: <non-empty reason>` (no shared fixtures or duplication emerged). The done-gate hard-blocks if this row is missing or has an empty skip reason on tickets that use the annotated checkbox format.

- [ ] cross-scenario
