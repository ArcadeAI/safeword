# Test Definitions: Architecture-doc prose persistence (JT852Q, layer A)

Feature source: `features/architecture-prose-persistence.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Prose survives a real (writing) heal — parse and render are exact inverses

### Scenario: An unaffected section's prose is byte-identical across a writing heal

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Prose survives a writing heal when the doc uses CRLF line endings

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A multi-paragraph description survives a writing heal intact

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: An unchanged doc is a fixed point (no enforcement churn)

### Scenario: Healing a doc with prose and no structural change is a no-op

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Structure still heals while prose is kept

### Scenario: A newly added module is born with the placeholder, not a neighbour's prose

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A section whose prose was deleted falls back to the placeholder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A structural change preserves the exact prose and flags it stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Re-healing an already-stale section keeps prose and one stale marker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Persistence applies to every doc that carries per-section prose

### Scenario: A monorepo leaf doc preserves its prose across a writing heal

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The derived root index has no per-node prose to preserve

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
