# Test Definitions: Prove cross-provider review before scaling spend

Feature source: `features/prove-cross-provider-review-before-scaling-spend.feature`

test-definitions.md is the R/G/R ledger. Detailed native-envelope parsing, exact
pricing arithmetic, receipt corruption, ordering mutations, and authorization
field mutations remain in table-driven ticket-local contract tests; they are not
duplicated here as acceptance scenarios.

## Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R1 — The recorded provider identity matches the provider that performed every paid turn

### Scenario: The development runner uses Terra for every review stage

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A complete Terra call inventory is accepted

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Untrustworthy provider evidence is rejected

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Trusted corpus provenance is copied without embellishment

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Development provenance cannot be replaced

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One authorized live attempt proves the paid route

This manual, one-time operational proof must produce its own evidence. Passing
fixture scenarios do not substitute for its RED, GREEN, or REFACTOR record.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R2 — Durable attempt and cost evidence bounds every new paid attempt

### Scenario: Explicit initialization creates an empty authorized checkpoint

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Complete accounting enforces both paid limits after restart

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Missing or contradictory accounting fails closed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A multi-turn review consumes one attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A provider failure is not retried invisibly

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A completed attempt that reaches the spend limit is retained

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Invalid paid work is never refunded or assigned an invented price

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Frozen native usage determines the exact pricing policy

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Weak or replayed authorization cannot dispatch paid work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R3 — Development evidence remains permanently separate from confirmatory evidence

### Scenario: A development result is durably diagnostic-only

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Development evidence cannot authorize confirmation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Independently anchored confirmatory evidence remains usable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Lower-level contract coverage retained outside BDD

- Strict native response schemas and request/response pairing permutations.
- Every short- and long-context component rate in integer picodollars.
- Cached, uncached, cache-write, output, and reasoning-token arithmetic.
- Every local/upstream receipt deletion, duplication, sequence, digest, and head mismatch.
- Every authorization author, repository, corpus, output, route, code-pin, and limit mutation.
- Same-process pure-decision combinations and exhaustive simultaneous reason sets.
- Default and continuous-integration selector exclusion of `@paid-canary` and `@manual`.

## Feature-level cross-scenario refactor

- [x] cross-scenario — `19ed43ac3`
