# Test Definitions: Keep failed reviews out of benchmark scores

Feature source: `features/reject-incomplete-evaluation-trials.feature`

test-definitions.md is the R/G/R ledger.

## Rule: pr-review-eval.SWM1.R1 — Only positively complete trials are scoreable

### Scenario: A completed reviewer finding is usable

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A completed reviewer may return multiple findings

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A completed reviewer may explicitly find nothing

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Hidden completion failures are unusable

- [x] RED 640c3bf11
- [x] GREEN 2145bb94f
- [ ] REFACTOR

## Rule: pr-review-eval.SWM1.R2 — Failure handling preserves paired experimental validity

### Scenario: One infrastructure failure is retried once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A second infrastructure failure excludes the paired case

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A non-infrastructure failure gets no silent retry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Paired-case quarantine is atomic

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An early failure cancels pending paired work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A retryable failure followed by a semantic failure ends the pair

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Frozen reserves are selected deterministically

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Crash recovery preserves one quarantine and reserve decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Interrupted quarantine is never partially scoreable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reserve exhaustion stops the run

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: pr-review-eval.SWM1.R3 — Scoring derives validity from admitted records

### Scenario: A complete run is scoreable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A structurally incomplete paired case is not scoreable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Validity gates change when admitted evidence changes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: pr-review-eval.SWM1.R4 — A paid canary gates larger spend

### Scenario: The no-cost fixture inventory is independently checkable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Operational failure injection covers the R2 taxonomy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The paid canary outcomes are independently checkable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A hidden provider failure is rejected through real wiring

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A clean canary authorizes the next checkpoint

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One failed canary call blocks more spend

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One canary label disagreement blocks more spend

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Total cost includes every attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Incomplete canary cost data blocks more spend

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: pr-review-eval.SWM1.R5 — Raw evidence and corpus roles cannot drift

### Scenario: Frozen raw artifacts can be reused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Drifted raw evidence cannot be reused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The void corpus cannot confirm or tune the replacement scorer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Confirmatory estimates use a fresh holdout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Invalid holdout construction cannot produce confirmatory estimates

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
