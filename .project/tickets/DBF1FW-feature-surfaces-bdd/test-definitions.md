# Test Definitions: Let projects track feature surfaces during BDD

Feature source: `features/feature-surfaces-bdd.feature`

test-definitions.md is the R/G/R ledger. Keep executable Given/When/Then
scenarios in the `.feature` file; keep only scenario progress here so hooks can
derive the active RED/GREEN/REFACTOR step.

## Rule: Project setup scaffolds the surface inventory at the resolved namespace root

### Scenario: Fresh setup creates a starter surfaces file

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Configured namespace root receives the starter surfaces file on upgrade

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Surface files follow the persona managed-file contract

### Scenario: Existing surface inventory survives setup byte-identical

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Configured surfaces path suppresses the default scaffold

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: BDD artifacts name surfaces without adding a hard gate

### Scenario: BDD intake loads project surfaces after personas and glossary

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Feature specs include an optional Surfaces section

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Feature sources prove affected surface coverage

### Scenario: Check reports an affected runtime with no feature tag

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

- [x] cross-scenario
