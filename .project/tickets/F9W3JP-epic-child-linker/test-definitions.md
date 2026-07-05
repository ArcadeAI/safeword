# Test Definitions: `ticket new --parent` epic-child linker (F9W3JP)

Feature source: `packages/cli/features/epic-child-linker.feature`

<!-- Scenario lineage: epic-child-linker.TB1.AC<#>. AC1 = bidirectional link
     (child parent: + epic children[] append) + navigation; AC2 = index grouping
     via parent:; AC3 = fail-loud validation with no mutation; AC4 = idempotent,
     order-preserving append. Test layers: link mechanics (validate-epic,
     append-if-absent, atomic write) are unit tests of a pure helper over a real
     temp-dir fs; end-to-end --parent behavior + exit codes are command-level via
     runCli; index grouping is asserted at the sync-tickets command level.
     test-definitions.md is the R/G/R ledger — G/W/T lives in the .feature. -->

## Rule: --parent links a new child to its epic both ways

### Scenario: epic-child-linker.TB1.AC1.linking_records_parent_and_appends_to_epic

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: epic-child-linker.TB1.AC1.navigation_from_epic_reaches_child

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A linked child appears under its epic in the index

### Scenario: epic-child-linker.TB1.AC2.index_groups_child_under_epic

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: An invalid --parent fails loud and changes nothing

### Scenario: epic-child-linker.TB1.AC3.missing_parent_rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: epic-child-linker.TB1.AC3.non_epic_parent_rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Linking is idempotent and preserves the epic's existing children

### Scenario: epic-child-linker.TB1.AC4.second_child_preserves_first

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: epic-child-linker.TB1.AC4.linking_twice_adds_at_most_once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
