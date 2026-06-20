# Test Definitions: Whole-ticket quality review + refactor before verify

Feature source: `features/whole-ticket-quality-refactor.feature`

test-definitions.md is the R/G/R ledger. Keep executable Given/When/Then
scenarios in the `.feature` file; keep only scenario progress here so hooks can
derive the active RED/GREEN/REFACTOR step.

## Rule: The whole-ticket pass is required only above one loop

### Scenario: A single annotated loop is exempt despite the annotation

- [x] RED 024d25a
- [x] GREEN 2ea3cdc
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A ticket with zero parsed scenarios needs no row

- [x] RED 024d25a
- [x] GREEN 2ea3cdc
- [x] REFACTOR skip: no structural improvement needed

### Scenario: Exactly two annotated loops require the cross-scenario row

- [x] RED 024d25a
- [x] GREEN 2ea3cdc
- [x] REFACTOR skip: no structural improvement needed

### Scenario: Exactly two annotated loops with a refactor commit pass

- [x] RED 024d25a
- [x] GREEN 2ea3cdc
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A multi-scenario ticket with no annotations stays exempt

- [x] RED 024d25a
- [x] GREEN 2ea3cdc
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A single-loop ticket with a present empty-skip row is still blocked

- [x] RED 024d25a
- [x] GREEN 2ea3cdc
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A two-loop ticket with an empty skip reason is blocked

- [x] RED 024d25a
- [x] GREEN 2ea3cdc
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A two-loop ticket with a real skip reason passes

- [x] RED 024d25a
- [x] GREEN 2ea3cdc
- [x] REFACTOR skip: no structural improvement needed

## Rule: Tasks and features share one validation path

### Scenario: A two-loop task is blocked by the same validator as a feature

- [x] RED 638c6c9
- [x] GREEN 3ecb35e
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A two-loop task is blocked for a missing quality review

- [x] RED 638c6c9
- [x] GREEN 3ecb35e
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A single-loop task proceeds without a row

- [x] RED 638c6c9
- [x] GREEN 3ecb35e
- [x] REFACTOR skip: no structural improvement needed

## Rule: The quality-review half is proven by its invocation log

### Scenario: A two-loop ticket without a logged quality review is blocked

- [x] RED 638c6c9
- [x] GREEN 3ecb35e
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A two-loop ticket with a logged quality review passes the review check

- [x] RED 638c6c9
- [x] GREEN 3ecb35e
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A single-loop ticket is not blocked for a missing quality review

- [x] RED 638c6c9
- [x] GREEN 3ecb35e
- [x] REFACTOR skip: no structural improvement needed

---

## Feature-level cross-scenario refactor

Marked at implement-exit (the whole-ticket quality-review + refactor pass): either `<sha>` (the refactor commit) or `skip: <non-empty reason>` (no shared fixtures or duplication emerged). The done-gate hard-blocks a ticket with **two or more RGR loops** whose row is missing or has an empty skip reason; a single-loop ticket may leave it unmarked.

- [x] cross-scenario cd30baa
