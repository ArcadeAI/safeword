# Test Definitions: Architecture doc staleness enforcement (Slice 2)

Feature source: `features/architecture-staleness-enforcement.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A structural change is committed fresh, automatically and without blocking

### Scenario: A would-change doc is regenerated and staged into the commit (outline ×3)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Auto-staging preserves an unrelated staged change

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A doc that needs no change is left untouched at commit time

### Scenario: A doc that needs no change is not staged (outline ×2: unchanged, noop)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A foreign hand-written doc is never auto-staged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A stale architecture doc cannot reach the main branch

### Scenario: The CI check fails when the committed doc would change (outline ×3)

- [x] RED a908539
- [x] GREEN a908539
- [ ] REFACTOR

### Scenario: The CI check defaults to on when no config file is present

- [x] RED a908539
- [x] GREEN a908539
- [ ] REFACTOR

### Scenario: The CI check passes when nothing needs to change (outline ×3)

- [x] RED a908539
- [x] GREEN a908539
- [ ] REFACTOR

## Rule: Enforcement is on by default and can be opted out per project

### Scenario: The commit-time auto-fix obeys the enforcement switch (outline ×2)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Opting out makes the CI check pass despite a stale doc

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
