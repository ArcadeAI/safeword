# Test Definitions: Validate feature ticket readiness before define-behavior

Feature source: `features/feature-ticket-readiness.feature`

test-definitions.md is the R/G/R ledger. Keep executable Given/When/Then
scenarios in the `.feature` file; keep only scenario progress here so hooks can
derive the active RED/GREEN/REFACTOR step.

## Rule: New feature tickets must be ready before entering define-behavior

### Scenario: A feature missing scope frontmatter is denied when phase advances

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A feature missing spec and dimensions is denied before define-behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ready feature can enter define-behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A task can enter define-behavior without feature readiness artifacts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Legacy define-behavior tickets surface readiness before scenario guidance

### Scenario: A legacy define-behavior feature receives an upfront readiness message

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ready define-behavior feature keeps the normal scenario reminder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Readiness validation catches invalid artifact content

### Scenario: Invalid spec and dimensions skip reasons are reported together

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at implement-exit (the whole-ticket quality-review + refactor pass):
either `<sha>` (the refactor commit) or `skip: <non-empty reason>` (no shared
fixtures or duplication emerged). The done-gate hard-blocks a ticket with two
or more RGR loops whose row is missing or has an empty skip reason; a
single-loop ticket may leave it unmarked.

- [ ] cross-scenario
