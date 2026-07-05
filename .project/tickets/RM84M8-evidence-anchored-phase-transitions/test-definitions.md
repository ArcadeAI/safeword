# Test Definitions: Evidence-anchored phase transitions

Feature source: `features/evidence-anchored-phase-transitions.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.

## Rule: A forward phase advance carrying a valid anchor is recognized as anchored

### Scenario: Forward advance with a well-formed anchor for the entered phase is anchored

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance with a HEAD-reachable anchor is anchored under git resolution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A forward phase advance without a valid anchor is flagged as unanchored

### Scenario: Forward advance with no anchor recorded is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance whose anchor is malformed is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance whose anchor names the wrong phase is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance whose anchor is not reachable from HEAD is flagged under git resolution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The detector fires only on a feature ticket's forward advance

### Scenario: A backward phase move is not flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Re-declaring the same phase is not flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A non-feature ticket advancing is not flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An edit that leaves the phase unchanged is not flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
