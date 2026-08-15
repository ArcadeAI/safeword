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

### Scenario: The paid child receives only its provider credential

- [x] RED skip: independent review supplied the failing composition gap before the test and fix landed together
- [x] GREEN 24b70ee54
- [x] REFACTOR skip: the focused implementation was already at its smallest coherent boundary

### Scenario: Explicit initialization creates an empty authorized checkpoint

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Initialization refuses a redirected output root

- [x] RED skip: independent review supplied the failing symlink counterexample before the test and fix landed together
- [x] GREEN 24b70ee54
- [x] REFACTOR skip: the focused implementation was already at its smallest coherent boundary

### Scenario: Consumed initialization cannot reset durable accounting

- [ ] RED
- [x] GREEN 1b3bea1ea
- [x] REFACTOR skip: initialization replay reuses the one-time upstream-consumption guard

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

### Scenario Outline: A completed attempt that reaches the spend limit is retained

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid paid work with complete usage is not refunded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid paid work with out-of-policy usage gets no invented price

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Route-invalid paid work still consumes an attempt

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

### Scenario: Matching authorization admits a no-spend dispatch preflight

- [ ] RED
- [x] GREEN 24b70ee54
- [x] REFACTOR skip: the existing authorized composition test injects the child boundary without provider spend

### Scenario: Concurrent attempt start is atomic

- [ ] RED
- [x] GREEN 1d9933fd79
- [x] REFACTOR skip: the existing exclusive-attempt lock spans durable start through completion

### Scenario: Authorized corpus cannot dispatch unrelated paid input

- [x] RED skip: quality review supplied the failing counterexample before the test and fix landed together
- [x] GREEN 24b70ee54
- [x] REFACTOR 2c8d717e4

### Scenario: Validated paid input cannot change before child execution

- [x] RED skip: independent review supplied the failing byte-swap counterexample before the test and fix landed together
- [x] GREEN cb71377ec
- [x] REFACTOR skip: the digest handshake is already the smallest process-boundary contract

### Scenario: Existing attempt evidence blocks before paid execution

- [x] RED skip: independent review supplied the failing paid-call counterexample before the test and fix landed together
- [x] GREEN cb71377ec
- [x] REFACTOR skip: the pre-start existence guard is already a single focused check

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
- Provider/model/tier, response-shape, authorization, and corpus-anchor permutations represented by disjunctive acceptance rows.
- Same-process pure-decision combinations and exhaustive simultaneous reason sets.
- Default and continuous-integration selector exclusion of `@paid-canary` and `@manual`.

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: the reviewed behaviors already share the production accounting, authorization, and evidence seams; broader module extraction is deferred outside this safety fix
