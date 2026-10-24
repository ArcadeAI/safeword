# Test Definitions: Review complete branch changes before builders finish

Feature source: `packages/cli/features/review-complete-branch-before-finishing.feature`

test-definitions.md is the R/G/R ledger.

## Rule: branch-review.TBU1.R1 — The review selects and accounts for the complete branch against the ticket

### Scenario: A multi-file feature is reviewed from the integration merge base

- [x] RED 897464019
- [x] GREEN fddd53b36
- [ ] REFACTOR

### Scenario: A caller cannot shrink the branch by naming a later base

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A caller cannot shrink the branch by naming selected files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A configured topic branch cannot hide earlier work

- [x] RED 9045af6b6
- [x] GREEN 9a18e9342
- [ ] REFACTOR

### Scenario: Renamed, deleted, and force-added ignored paths remain in the inventory

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: branch-review.TBU1.R2 — Findings are prioritized and actionable across files

### Scenario: A cross-file behavior gap is explained

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: branch-review.TBU1.R3 — Later changes to reviewed work need a fresh review

### Scenario: A code fix during verification cannot inherit the earlier review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Routine ticket records do not restart branch review

- [x] RED 996feb72f
- [x] GREEN 4e9683e93
- [ ] REFACTOR

### Scenario: Changed ticket goals require a fresh review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: branch-review.TBU1.R4 — Implementation exit checks the saved review before advancing

### Scenario: A current complete review lets implementation finish

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each supported local host refuses changed work at implementation exit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A partial review can continue with clear disclosure

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A partial review cannot advance without acknowledgement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No branch changes cannot pass as a completed review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: branch-review.NTB1.R1 — The report distinguishes reviewed paths from omissions

### Scenario: A skipped generated path cannot count as complete coverage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An oversized authored file cannot count as completely reviewed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Sensitive file content stays out of the reviewer packet

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: branch-review.NTB1.R2 — The report tells a builder what to do next in plain language

### Scenario: A builder sees the next action for a partial review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: branch-review.NTB1.R3 — Freshness and coverage are reported separately

### Scenario: Missing integration base cannot claim a completed review

- [x] RED 323b928e6
- [x] GREEN 688e5e689
- [ ] REFACTOR

### Scenario: A dirty branch is current but only partially covered

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed later review pass leaves its paths omitted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Stale review still shows its missing evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
