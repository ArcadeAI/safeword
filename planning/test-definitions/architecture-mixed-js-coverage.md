# Test Definitions: Trustworthy mixed JS/TS architecture coverage

Feature source: `features/architecture-state-docs.feature`

test-definitions.md is the R/G/R ledger. Keep executable Given/When/Then
scenarios in the `.feature` file; keep only scenario progress here so hooks can
derive the active RED/GREEN/REFACTOR step.

## Rule: The skeleton reflects the complete top-level JS/TS source root

### Scenario: A mixed source root lists directories and loose modules

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A mixed lib root lists directories and loose modules

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A directory and same-named source file produce one directory-backed module

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A file-backed module heals to its same-named directory path

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Repeated mixed-tree generation is deterministic

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Generated-document ownership is explicit

### Scenario: The guide distinguishes machine-owned structure from preserved module prose

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

- [x] cross-scenario — skip: the shared source-root fixture and production
      enumerator already cover both scenarios without new duplication.
