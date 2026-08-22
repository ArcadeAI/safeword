# Test Definitions: Upgrade remote-test workflows safely

Feature source: `packages/cli/features/upgrade-remote-test-workflows-safely.feature`

This is the RED/GREEN/REFACTOR ledger. The implementation began while the
ticket was still deferred; historical entries name the retained evidence
without pretending the ledger drove those commits.

## Rule: upgrade-remote-test-workflows-safely.TBU1.R1 — Only exact released Safeword workflows authorize managed lifecycle changes

### Scenario Outline: Setup upgrades an unchanged released predecessor across checkout line endings

- [x] RED skip: historical implementation predates this activated migration ticket
- [x] GREEN e25d84b3a
- [x] REFACTOR skip: focused test is already direct and duplication-free

### Scenario Outline: Setup preserves a customer-edited predecessor across checkout line endings

- [x] RED skip: exact-digest rejection predates this strengthened scenario
- [x] GREEN abd3b15a9
- [x] REFACTOR skip: explicit byte matrix is the simplest stable proof

### Scenario: Disable removes an unchanged released workflow

- [x] RED skip: historical disable support predates this activated ticket
- [x] GREEN 7b7a782af
- [x] REFACTOR skip: direct lifecycle assertion needs no structural cleanup

### Scenario Outline: Disable preserves a customer-edited workflow across checkout line endings

- [x] RED 215cd0677
- [x] GREEN 21ca9b193
- [x] REFACTOR skip: removing the obsolete special case is already minimal

### Scenario Outline: Disable never removes a workflow that no longer revalidates as released v1

- [x] RED 52707bfe9
- [x] GREEN 511c0b4a5
- [x] REFACTOR skip: one adjacent reclassification is the minimal safe structure

### Scenario Outline: Disable completes when the commit-time state already needs no file

- [x] RED skip: prior revalidation GREEN supplies the shared commit-time branch
- [x] GREEN b97b36d86
- [x] REFACTOR skip: both outcomes use the same public revalidation path

## Rule: upgrade-remote-test-workflows-safely.TBU1.R2 — Interrupted upgrades expose complete predecessor or successor bytes and retry safely

### Scenario Outline: A changed or unreadable workflow prevents historical publication

- [x] RED skip: replacement publication already revalidates before rename
- [x] GREEN 95182c568
- [x] REFACTOR skip: existing replacement helper already owns preparation and cleanup

### Scenario Outline: Setup converges when the commit-time state needs no preservation

- [x] RED 75a1a349b
- [x] GREEN 85be61eac
- [x] REFACTOR skip: one broadened commit predicate expresses the required convergence

### Scenario: Failed private-file preparation preserves the released predecessor

- [x] RED skip: private preparation failure handling predates this scenario
- [x] GREEN 54af1c955
- [x] REFACTOR skip: existing private-file helper already centralizes cleanup

### Scenario: Failed publication preserves the released predecessor

- [x] RED skip: replacement rename failure handling predates this scenario
- [x] GREEN 1a75db228
- [x] REFACTOR skip: existing replacement helper already centralizes cleanup

### Scenario: Publication never writes through the visible workflow path

- [x] RED skip: private-file rename publication predates this scenario
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
