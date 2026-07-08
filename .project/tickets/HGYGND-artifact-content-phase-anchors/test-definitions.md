# Test Definitions: Artifact-content phase anchors

Feature source: `features/artifact-content-phase-anchors.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.
Two natural batches: the pure-predicate partitions (unit lane, one batched
R/G/R like RM84M8) and the boundary-command scenarios (temp-git-repo lane).
Supersedes RM84M8's ledger scope: `evidence-anchored-phase-transitions.feature`
and its steps are removed in this ticket's REFACTOR once these scenarios are
green.

## Rule: A forward advance anchors the entered phase to the exited phase's artifact

### Scenario: Forward advance recording the exited phase's artifact path is anchored

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Only the entered phase needs an anchor on a multi-step advance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Re-advancing a phase is judged by its latest anchor entry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: An anchored advance verifies from the tree alone, under any history

### Scenario: Verification consults only the supplied tree, never git history

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A squash-merged branch's ticket still verifies at the next boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A shallow clone verifies anchors identically to a full clone

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A forward advance without a real artifact behind it is detectable as unanchored

### Scenario: Forward advance with no phase_anchors block at all is flagged with the exact line to add

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance whose phase_anchors block names only an earlier phase is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance whose anchor value is empty is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance whose anchor is not a plausible repo-relative path is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance anchored to a path absent from the tree is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance anchored to a hollow scaffold artifact is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forward advance anchored to the wrong kind of artifact for the phase is flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

## Rule: Legacy SHA anchors neither warn at rest nor block new work

### Scenario: A hex-shaped legacy anchor on a ticket at rest stays silent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A new forward advance recording a hex-shaped anchor draws the migration remediation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The R/G/R ledger's per-tick commit SHAs are untouched

### Scenario: In one push, anchors verify from the tree while ledger SHAs still verify from history

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
