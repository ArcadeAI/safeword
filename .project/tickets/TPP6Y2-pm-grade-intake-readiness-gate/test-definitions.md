# Test Definitions: PM-grade intake readiness gate

Feature source: `features/pm-grade-intake-readiness-gate.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature` source.

## Rule: The readiness pointer surfaces only during Clarify

### Scenario: Pre-classify (no active ticket) surfaces the readiness pointer

- [x] RED e41e7e7
- [x] GREEN b236df7
- [x] REFACTOR skip: pure constant + predicate, no structural improvement needed

### Scenario: An intake-phase ticket surfaces the readiness pointer

- [x] RED 570e10b
- [x] GREEN ab75be3
- [x] REFACTOR skip: covered by the shared predicate, nothing to restructure

### Scenario: An implement-phase ticket suppresses the readiness pointer

- [x] RED 570e10b
- [x] GREEN ab75be3
- [x] REFACTOR skip: covered by the shared predicate, nothing to restructure

(Then asserts implement-phase TDD-step guidance still shows AND the pointer is absent — proves the conditional, not trivial absence.)

## Rule: The pointer is a compressed pointer, not a checklist

### Scenario: The pointer names all five dimensions

- [x] RED 570e10b
- [x] GREEN ab75be3
- [x] REFACTOR skip: single constant, no structural improvement needed

### Scenario: The pointer stays within the length cap

- [x] RED 570e10b
- [x] GREEN ab75be3
- [x] REFACTOR skip: single constant, no structural improvement needed

### Scenario: The constraint dimension is scoped to what must not break

- [x] RED 570e10b
- [x] GREEN ab75be3
- [x] REFACTOR skip: single constant, no structural improvement needed

## Rule: SAFEWORD.md carries the triage guidance

### Scenario: SAFEWORD.md states the value-of-information triage

- [x] RED 570e10b
- [x] GREEN ab75be3
- [x] REFACTOR skip: prose addition, no structural improvement needed

### Scenario: SAFEWORD.md defines readiness as edge-case-level questions

- [x] RED 570e10b
- [x] GREEN ab75be3
- [x] REFACTOR skip: prose addition, no structural improvement needed

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: two RGR loops over one cohesive pure module; no cross-loop duplication to extract
