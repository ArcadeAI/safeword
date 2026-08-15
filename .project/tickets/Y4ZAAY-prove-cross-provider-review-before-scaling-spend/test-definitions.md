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

- [x] RED skip: retrospective acceptance mapping — the digest-mismatch counterexample predated this ledger row
- [x] GREEN cf5310b54
- [x] REFACTOR skip: provenance retention and digest validation share one manifest boundary

### Scenario: One authorized live attempt proves the paid route

This manual, one-time operational proof must produce its own evidence. Passing
fixture scenarios do not substitute for its RED, GREEN, or REFACTOR record.

- [x] RED live preflight: the first three isolated output identities exposed, without retry, an absent protected-main registration, missing Terra lane overrides, and unpriced native `incomplete/max_output_tokens` responses
- [x] GREEN `terra-harness-v11` / authorization comment `5301047471`: attempt 1 durably retained both stages, Terra/default route evidence, and completion receipt `5301058101` at `1152977750000` picodollars
- [x] REFACTOR skip: the live failures were closed at their existing authorization, environment, and envelope-validation boundaries; no new abstraction was needed

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

- [x] RED skip: independent review supplied the replay-reset counterexample before the focused regression test and fix landed together
- [x] GREEN 1b3bea1ea
- [x] REFACTOR skip: initialization replay reuses the one-time upstream-consumption guard

### Scenario Outline: Complete accounting enforces both paid limits after restart

- [x] RED skip: retrospective acceptance mapping — restart reconciliation tests predated this ledger row
- [x] GREEN 8e43ed1c3
- [x] REFACTOR skip: one reconciled snapshot supplies both attempt and cost decisions

### Scenario Outline: Missing or contradictory accounting fails closed

- [x] RED skip: retrospective acceptance mapping — corruption and asymmetric-chain tests predated this ledger row
- [x] GREEN 8e43ed1c3
- [x] REFACTOR skip: all accounting defects converge on the same incomplete snapshot

### Scenario: A multi-turn review consumes one attempt

- [x] RED skip: retrospective acceptance mapping — the two-stage inventory test predated this ledger row
- [x] GREEN 3b85ed533
- [x] REFACTOR skip: attempt identity already encloses the ordered provider-turn inventory

### Scenario: A provider failure is not retried invisibly

- [x] RED skip: independent review supplied the hidden-retry counterexample before the regression landed
- [x] GREEN 1d9933fd7
- [x] REFACTOR skip: the durable intent is the single retry boundary

### Scenario Outline: A completed attempt that reaches the spend limit is retained

- [x] RED skip: retrospective acceptance mapping — threshold-crossing retention tests predated this ledger row
- [x] GREEN 604c68863
- [x] REFACTOR skip: limits are evaluated only from completed retained attempts

### Scenario: Invalid paid work with complete usage is not refunded

- [x] RED skip: independent review supplied the route-invalid refund counterexample before the regression landed
- [x] GREEN 8ab1d0dc8
- [x] REFACTOR skip: native usage is priced before route validity is admitted

### Scenario: Invalid paid work with out-of-policy usage gets no invented price

- [x] RED skip: retrospective acceptance mapping — incomplete-cost tests predated this ledger row
- [x] GREEN 604c68863
- [x] REFACTOR skip: invalid native usage leaves the existing accounting snapshot incomplete

### Scenario: Route-invalid paid work still consumes an attempt

- [x] RED skip: independent review supplied the route-invalid accounting counterexample before the regression landed
- [x] GREEN 8ab1d0dc8
- [x] REFACTOR skip: attempt retention is independent from result admission

### Scenario Outline: Frozen native usage determines the exact pricing policy

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Missing cache-write detail is normalized without changing the tier

- [x] RED skip: retrospective acceptance proof — native usage normalization predated this scenario
- [x] GREEN cb1944323
- [x] REFACTOR skip: the existing envelope validator remains the single pricing boundary

### Scenario Outline: Weak or replayed authorization cannot dispatch paid work

- [x] RED skip: retrospective acceptance mapping — authorization mutation tests predated this ledger row
- [x] GREEN 73712f5a9
- [x] REFACTOR skip: exact authorization parsing is one fail-closed boundary

### Scenario: Matching authorization admits a no-spend dispatch preflight

- [x] RED skip: independent review supplied the missing positive dispatch boundary before the composition test and fix landed together
- [x] GREEN 24b70ee54
- [x] REFACTOR skip: the existing authorized composition test injects the child boundary without provider spend

### Scenario: Concurrent attempt start is atomic

- [x] RED skip: independent review supplied the two-process lost-update counterexample before the contention test and lock fix landed together
- [x] GREEN 1d9933fd79
- [x] REFACTOR skip: the existing exclusive-attempt lock spans durable start through completion

### Scenario Outline: Authorized corpus cannot dispatch unrelated paid input

- [x] RED skip: quality review supplied the failing counterexample before the test and fix landed together
- [x] GREEN 24b70ee54
- [x] REFACTOR 2c8d717e4

### Scenario: Automated lanes exclude live paid proof

- [x] RED skip: retrospective acceptance proof — the repository selectors predated this scenario
- [x] GREEN cb1944323
- [x] REFACTOR skip: every automated entry point shares the same exact tag expression

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

- [x] RED skip: retrospective acceptance mapping — diagnostic manifest tests predated this ledger row
- [x] GREEN cf5310b54
- [x] REFACTOR skip: the retained manifest owns both role and provenance

### Scenario Outline: Development evidence cannot authorize confirmation

- [x] RED skip: retrospective acceptance mapping — holdout-role rejection tests predated this ledger row
- [x] GREEN 3c60a62e1
- [x] REFACTOR skip: the confirmatory guard rejects role, overlap, anchor, and registration defects together

### Scenario: Independently anchored confirmatory evidence remains usable

- [x] RED d6d054141
- [x] GREEN 3c60a62e1
- [x] REFACTOR skip: one guard admits only an independently preregistered disjoint holdout

## Lower-level contract coverage retained outside BDD

- Strict native response schemas and request/response pairing permutations.
- Every short- and long-context component rate in integer picodollars.
- Cached, uncached, cache-write, output, and reasoning-token arithmetic.
- Every local/upstream receipt deletion, duplication, sequence, digest, and head mismatch.
- Every authorization author, repository, corpus, output, route, code-pin, and limit mutation.
- Provider/model/tier, response-shape, authorization, and corpus-anchor permutations represented by disjunctive acceptance rows.
- Same-process pure-decision combinations and exhaustive simultaneous reason sets.

## Feature-level cross-scenario refactor

All acceptance scenarios now have their own GREEN evidence. The final live
hardening stayed within existing authorization, launcher, and envelope seams;
broader module extraction remains unrelated to this safety proof.

- [x] cross-scenario: route, accounting, authorization, and diagnostic-isolation responsibilities remain separate and no duplicate behavior was added
