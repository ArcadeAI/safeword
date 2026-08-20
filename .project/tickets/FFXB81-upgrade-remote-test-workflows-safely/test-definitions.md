# Test Definitions: Upgrade remote-test workflows safely

Feature source: `packages/cli/features/upgrade-remote-test-workflows-safely.feature`

This is the RED/GREEN/REFACTOR ledger. The implementation began while the
ticket was still deferred; historical entries name the retained evidence
without pretending the ledger drove those commits.

## Rule: upgrade-remote-test-workflows-safely.TBU1.R1 — Only exact released Safeword workflows authorize managed lifecycle changes

### Scenario Outline: Setup upgrades an unchanged released predecessor across checkout line endings

- [x] RED skip: historical implementation predates this activated migration ticket
- [x] GREEN e25d84b3a
- [ ] REFACTOR

### Scenario Outline: Setup preserves a customer-edited predecessor across checkout line endings

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Disable removes an unchanged released workflow

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Disable preserves a customer-edited workflow across checkout line endings

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Disable never removes a workflow that no longer revalidates as released v1

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Disable completes when the commit-time state already needs no file

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: upgrade-remote-test-workflows-safely.TBU1.R2 — Interrupted upgrades expose complete predecessor or successor bytes and retry safely

### Scenario Outline: A changed or unreadable workflow prevents historical publication

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Setup converges when the commit-time state needs no preservation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Failed private-file preparation preserves the released predecessor

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Failed publication preserves the released predecessor

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Publication never writes through the visible workflow path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Retry ignores foreign crash residue and installs the current workflow

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario

Historical implementation commits a74ac28fd, 648544cd3, 697106b27, 62082bf1f,
67eb3ff8f, and 1bd51c9c6 remain useful provenance, but the current scenarios are
reopened so their stronger guards and exact outcomes receive honest executable
evidence.
