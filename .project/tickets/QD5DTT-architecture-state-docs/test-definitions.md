# Test Definitions: Architecture state docs — Slice 1

Feature source: `features/architecture-state-docs.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature` source; this file tracks per-scenario RED → GREEN → REFACTOR progress.

## Rule: The skeleton reflects the real project

### Scenario: The listed modules equal the real tree, with resolving references

- [x] RED 70fb2d2
- [x] GREEN f73c7d5
- [ ] REFACTOR skip: minimal enumeration, no structural improvement needed

### Scenario: Every skeleton node carries a non-empty purpose

- [x] RED e55e9fd
- [x] GREEN 1cce7a9
- [ ] REFACTOR skip: simple filter + constant, no structural improvement needed

### Scenario: A file outside any module is not listed as a node

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A project with no src directory still produces a doc

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A src directory with zero modules produces an empty skeleton

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

### Scenario: A section describing a removed node is flagged orphaned, not merely stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A newly added node gets a purpose placeholder and is not marked stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Structural facts self-heal at session start

### Scenario: A moved fingerprint heals the doc to the current shape

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

### Scenario: A doc with a missing or corrupt fingerprint is regenerated, never left unreconciled

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The fingerprint captures shape, not noise

### Scenario Outline: The fingerprint changes only for structural change

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An out-of-band change is healed and its lagging prose flagged at session start

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
