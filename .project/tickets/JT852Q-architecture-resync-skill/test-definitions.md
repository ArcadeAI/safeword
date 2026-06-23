# Test Definitions: Architecture-doc prose persistence (JT852Q, layer A)

Feature source: `features/architecture-prose-persistence.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Prose survives a real (writing) heal — parse and render are exact inverses

### Scenario: An unaffected section's prose is byte-identical across a writing heal

- [x] RED 2a742a1
- [x] GREEN 2a742a1
- [x] REFACTOR dc99df2

### Scenario: Prose survives a writing heal when the doc uses CRLF line endings

- [x] RED 2a742a1
- [x] GREEN 2a742a1
- [x] REFACTOR dc99df2

### Scenario: A multi-paragraph description survives a writing heal intact

- [x] RED 2a742a1
- [x] GREEN 2a742a1
- [x] REFACTOR dc99df2

## Rule: An unchanged doc is a fixed point (no enforcement churn)

### Scenario: Healing a doc with prose and no structural change is a no-op

- [x] RED 2a742a1
- [x] GREEN 2a742a1
- [x] REFACTOR dc99df2

## Rule: Structure still heals while prose is kept

### Scenario: A newly added module is born with the placeholder, not a neighbour's prose

- [x] RED 2a742a1
- [x] GREEN 2a742a1
- [x] REFACTOR dc99df2

### Scenario: A section whose prose was deleted falls back to the placeholder

- [x] RED 2a742a1
- [x] GREEN 2a742a1
- [x] REFACTOR dc99df2

### Scenario: A structural change preserves the exact prose and flags it stale

- [x] RED 2a742a1
- [x] GREEN 2a742a1
- [x] REFACTOR dc99df2

### Scenario: Re-healing an already-stale section keeps prose and one stale marker

- [x] RED 2a742a1
- [x] GREEN 2a742a1
- [x] REFACTOR dc99df2

## Rule: Persistence applies to every doc that carries per-section prose

### Scenario: A monorepo leaf doc preserves its prose across a writing heal

- [x] RED 2a742a1
- [x] GREEN 2a742a1
- [x] REFACTOR dc99df2

### Scenario: The derived root index has no per-node prose to preserve

- [x] RED 2a742a1
- [x] GREEN 2a742a1
- [x] REFACTOR dc99df2
