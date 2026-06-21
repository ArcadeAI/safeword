# Test Definitions: PM-grade intake readiness gate

Feature source: `features/pm-grade-intake-readiness-gate.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature` source.

## Rule: The readiness pointer surfaces only during Clarify

### Scenario: Pre-classify (no active ticket) surfaces the readiness pointer

- [x] RED e41e7e7
- [x] GREEN b236df7
- [x] REFACTOR skip: pure constant + predicate, no structural improvement needed

### Scenario: An intake-phase ticket surfaces the readiness pointer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An implement-phase ticket suppresses the readiness pointer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

(Then asserts implement-phase TDD-step guidance still shows AND the pointer is absent — proves the conditional, not trivial absence.)

## Rule: The pointer is a compressed pointer, not a checklist

### Scenario: The pointer names all five dimensions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The pointer stays within the length cap

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The constraint dimension is scoped to what must not break

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: SAFEWORD.md carries the triage guidance

### Scenario: SAFEWORD.md states the value-of-information triage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: SAFEWORD.md defines readiness as edge-case-level questions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
