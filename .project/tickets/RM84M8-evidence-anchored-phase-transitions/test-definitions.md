# Test Definitions: Evidence-anchored phase transitions

Feature source: `features/evidence-anchored-phase-transitions.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.
Combinatorial pure-logic feature: one batched RED (1050da6) → GREEN (cd064e7) →
REFACTOR (eced2b7, the shared-parser extraction all scenarios exercise).

## Rule: A forward phase advance carrying a valid anchor for the entered phase is recognized as anchored

### Scenario: Forward advance with a well-formed anchor for the entered phase is anchored

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

### Scenario: Only the entered phase needs an anchor on a multi-step advance

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

### Scenario: A rebased anchor that canonicalizes to a reachable commit is anchored

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

## Rule: A forward phase advance without a valid anchor for the entered phase is flagged as unanchored

### Scenario: Forward advance with no phase_anchors block at all is flagged

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

### Scenario: Forward advance whose phase_anchors block names only an earlier phase is flagged

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

### Scenario: Forward advance whose anchor is not hex is flagged

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

### Scenario: Forward advance whose anchor value is empty is flagged

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

### Scenario: Forward advance whose anchor is not reachable from HEAD is flagged under git resolution

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

## Rule: The detector fires only on a feature ticket's forward advance

### Scenario: A backward phase move is not flagged

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

### Scenario: Re-declaring the same phase is not flagged

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

### Scenario: A non-feature ticket advancing is not flagged

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

### Scenario: A ticket becoming a feature past intake is not flagged

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

### Scenario: An edit that leaves the phase unchanged is not flagged

- [x] RED 1050da6
- [x] GREEN cd064e7
- [x] REFACTOR eced2b7

## Feature-level cross-scenario refactor

- [x] cross-scenario eced2b7
