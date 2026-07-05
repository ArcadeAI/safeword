# Test Definitions: Evidence-anchored phase transitions

Feature source: `features/evidence-anchored-phase-transitions.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.

## Rule: A forward phase advance carrying a valid anchor for the entered phase is recognized as anchored

### Scenario: Forward advance with a well-formed anchor for the entered phase is anchored

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Only the entered phase needs an anchor on a multi-step advance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A rebased anchor that canonicalizes to a reachable commit is anchored

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A forward phase advance without a valid anchor for the entered phase is flagged as unanchored

### Scenario: Forward advance with no phase_anchors block at all is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance whose phase_anchors block names only an earlier phase is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance whose anchor is not hex is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance whose anchor value is empty is flagged

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

### Scenario: A ticket becoming a feature past intake is not flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An edit that leaves the phase unchanged is not flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
