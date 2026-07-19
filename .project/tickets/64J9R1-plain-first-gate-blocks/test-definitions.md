# Test Definitions: Plain-first gate blocks

Feature source: `features/plain-first-gate-blocks.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the feature
source; this file tracks TDD progress per scenario.

## Rule: plain-first-gate-blocks.NTB1.R1 — Every hard block leads with a plain sentence

### Scenario: Every gate's block opens with a plain sentence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A block that opens with an internal token is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plain-first-gate-blocks.NTB1.R2 — Every hard block names exactly one next action

### Scenario: Every gate's block carries one next-step line

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A block that does not carry exactly one next-step line is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plain-first-gate-blocks.NTB1.R3 — No bare internal term stands alone

### Scenario: Every gate's block glosses or replaces its internal terms

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A block with an unglossed internal term is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plain-first-gate-blocks.NTB1.R4 — The block is self-sufficient; /explain is optional

### Scenario: Every gate's next step is a real action, not "run /explain"

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: /explain appears only as optional detail

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A block whose only next step is /explain is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A block that presents /explain as a required extra step is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Plainness holds across every harness

### Scenario: The same block renders plain-first on Cursor and Codex

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
