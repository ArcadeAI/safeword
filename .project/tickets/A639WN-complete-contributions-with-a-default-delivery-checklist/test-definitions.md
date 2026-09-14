# Test Definitions: Complete contributions with a default delivery checklist

Feature source: `features/complete-contributions-with-a-default-delivery-checklist.feature`

test-definitions.md is the R/G/R ledger.

## Rule: plan-implementability.TBU2.A639WN.R1 — The Safeword CLI exposes a deny-only execution prerequisite that requires accepted scenarios, an accepted implementation approach, and one visible default Delivery Checklist

### Scenario: The installed CLI exposes a satisfied execution prerequisite

- [x] RED 54af6fdf5
- [x] GREEN 240ccec06
- [x] REFACTOR dec938ae9

### Scenario: Missing contribution context blocks execution readiness

- [x] RED 54af6fdf5
- [x] GREEN 240ccec06
- [x] REFACTOR dec938ae9

### Scenario: Several missing prerequisites are reported in deterministic planning order

- [x] RED 54af6fdf5
- [x] GREEN 240ccec06
- [x] REFACTOR dec938ae9

## Rule: plan-implementability.TBU2.A639WN.R2 — The feature Delivery Checklist covers outcome and scope, resolved decisions, dependency and pull-request decomposition, testing, data and compatibility, monitoring and failure signals, security and privacy, rollout and rollback, documentation, ownership and human dependencies, and concrete completion evidence

### Scenario: A complete checklist exposes every default obligation category

- [x] RED b95affd4f
- [x] GREEN 06add9684
- [x] REFACTOR skip: parser boundaries are already separated by responsibility

### Scenario: A silently omitted default category prevents checklist completion

- [x] RED c2c4cdbe5
- [x] GREEN c1b07cec5
- [x] REFACTOR skip: canonical-order validation is already a single direct pass

## Rule: plan-implementability.TBU2.A639WN.R3 — Safeword carries the checklist through feature execution rather than using it only as an end-of-work audit, and each category is completed with evidence, marked not applicable with a concrete reason, or recorded as an explicit human-owned dependency

### Scenario: An applicable item records an honest disposition

- [x] RED 13d6a8be5
- [x] GREEN 07e0054a7
- [x] REFACTOR skip: disposition-specific checks are already small named predicates

### Scenario: Contributor-controlled work cannot be dismissed as a human handoff

- [x] RED b8e731844
- [x] GREEN db08befa5
- [x] REFACTOR skip: one direct owner-disposition guard is the smallest clear rule

### Scenario: Applicable contributor work cannot be dismissed as not applicable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: In-flight checklist state reflects partial execution progress

- [x] RED 2b0bed8ad
- [x] GREEN 4ef8c0a40
- [x] REFACTOR skip: validation, row rendering, and exact-snapshot replacement are separate seams

### Scenario: An unreadable Execution Plan blocks checklist updates

- [x] RED d00277c4d
- [x] GREEN f97d5efa9
- [x] REFACTOR skip: plan reading and parsing were extracted into one focused helper during GREEN

## Rule: plan-implementability.TBU2.A639WN.R4 — The feature checklist lives in the Execution Plan; the 3EG00H TBU3 small-work contract separately owns proportionate task and patch checklist behavior without creating feature artifacts

### Scenario: The feature Delivery Checklist lives in the Execution Plan

- [x] RED 4c2ccc16f
- [x] GREEN eadc5e773
- [x] REFACTOR 9d9fc74c6

### Scenario: The feature checklist contract cannot impose feature artifacts on smaller work

- [x] RED 54af6fdf5
- [x] GREEN 240ccec06
- [x] REFACTOR skip: one explicit feature-type applicability predicate is the smallest boundary

## Rule: plan-implementability.TBU2.A639WN.R5 — Large feature contributions use the reviewable pull-request slicing contract from child 6XW8H7, while a contribution small enough for one coherent review records that decision without artificial decomposition

### Scenario: The checklist records the appropriate PR-slicing outcome

- [x] RED e3a24a8fc
- [x] GREEN bb3565467
- [x] REFACTOR e4ea44f24

### Scenario: A large contribution cannot leave PR slicing unresolved

- [x] RED 3f988cf67
- [x] GREEN eb813d834
- [x] REFACTOR skip: plan-derived recovery is already one bounded projection at the review-result edge

## Rule: plan-implementability.TBU2.A639WN.R6 — Safeword reports contributor readiness only when every contributor-controlled obligation is completed and proven, reports pending human approvals or ownership as unresolved dependencies, and never treats readiness evidence as human approval or merge authority

### Scenario: Readiness reports the next owning boundary without inventing authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Contributor evidence cannot record human approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.A639WN.R7 — This child defines the canonical Delivery Checklist evidence-currency taxonomy—current-revision real-boundary proof, reusable earlier-revision proof, partial or structural proof, and missing proof—and never silently upgrades one class into another

### Scenario: Evidence class controls the claim Safeword may make

- [x] RED 1b5e17b99
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Earlier or partial evidence cannot silently become current complete proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
