# Test Definitions: Upgrade remote-test workflows safely

Feature source: `packages/cli/features/upgrade-remote-test-workflows-safely.feature`

This is the RED/GREEN/REFACTOR ledger. The implementation began while the
ticket was still deferred; historical entries name the retained evidence
without pretending the ledger drove those commits.

## Rule: upgrade-remote-test-workflows-safely.TBU1.R1 — Only exact released Safeword workflows authorize managed lifecycle changes

### Scenario: Setup upgrades an unchanged released workflow

- [x] RED a74ac28fd
- [x] GREEN 648544cd3
- [x] REFACTOR 5cf7a45b7

### Scenario: Setup preserves a customer-edited predecessor

- [x] RED skip: pre-existing customer-ownership rejection test already covered this unchanged invariant
- [x] GREEN skip: no implementation change was required for preserved customer-owned behavior
- [x] REFACTOR skip: exact digest classification reuses the existing ownership result

### Scenario: Disable removes an unchanged released workflow

- [x] RED skip: historical lifecycle coverage existed before FFXB81 activation
- [x] GREEN skip: the historical implementation commit bundled this path with the setup migration loop
- [x] REFACTOR skip: shared managed-history classification is already the smallest common path

## Rule: upgrade-remote-test-workflows-safely.TBU1.R2 — Interrupted upgrades expose complete predecessor or successor bytes and retry safely

### Scenario: Failed replacement preparation preserves the released predecessor

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Retry after a preparation failure installs the complete current workflow

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
