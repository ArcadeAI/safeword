# Test Definitions: Architecture state docs — Slice 1

Feature source: `features/architecture-state-docs.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature` source; this file tracks per-scenario RED → GREEN → REFACTOR progress.

## Rule: The skeleton reflects the real project

### Scenario: Each top-level module appears with a code reference

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every skeleton node carries a one-line purpose

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A non-structural file is not listed as a node

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A project with no src directory still produces a doc

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unparseable source file does not abort extraction

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Stale prose is visibly flagged, never silently wrong

### Scenario: Prose reconciled with the current structure shows no marker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Prose that has fallen behind the structure is marked stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Prose describing a removed node is flagged as orphaned

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A newly added node requires a purpose but is not marked stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Structural facts self-heal at session start

### Scenario: A moved fingerprint triggers re-extraction at session start

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unchanged fingerprint leaves the doc untouched

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A project with no architecture doc gets one created

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The fingerprint captures shape, not noise

### Scenario Outline: The fingerprint moves only for structural change

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An out-of-band structural change is detected at the next session start

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
