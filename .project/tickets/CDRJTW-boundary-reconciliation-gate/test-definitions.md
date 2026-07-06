# Test Definitions: Boundary reconciliation gate (slice 1)

Feature source: `features/boundary-reconciliation-gate.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.

## Rule: A commit touching ticket artifacts gets its evidence reconciled and recorded

### Scenario: A staged ticket change with clean evidence passes quietly and is recorded

- [x] RED 9891378
- [x] GREEN c794510
- [ ] REFACTOR

### Scenario: A staged forward phase advance without an anchor is warned and recorded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A feature ticket at rest born past intake is warned at the boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A staged ticket.md with unparseable frontmatter is warned, never crashed on

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Several tickets in one commit are each reconciled with verdicts grouped per ticket

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An invalid ledger annotation is warned at the commit boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A feature ticket whose ledger is absent entirely is warned

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed evidence artifact is warned about by name

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The commit tier consults no git history — reachability waits for push

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A mixed commit of source files and one ticket artifact is reconciled, not silent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A push additionally verifies evidence against reachable history

### Scenario: A well-formed anchor that is not reachable from the pushed history is warned

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Anchors recorded before a rebase still verify after it

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Only the entered phase's anchor is demanded on a multi-phase advance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ledger step SHAs are verified against the pushed history

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failing SHA resolution is recorded as indeterminate, never a crash

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A branch pushed for the first time still gets its outgoing work reconciled

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The gate is silent and free for changes that touch no ticket artifacts

### Scenario: A commit touching only source code produces no output and no audit entry

- [x] RED 9891378
- [x] GREEN c794510
- [ ] REFACTOR

### Scenario: A push whose outgoing range contains no ticket-artifact changes is a silent no-op

- [x] RED 9891378
- [x] GREEN c794510
- [ ] REFACTOR

### Scenario: Outside a safeword project the command is a silent no-op

- [x] RED 9891378
- [x] GREEN c794510
- [ ] REFACTOR

## Rule: Findings never block — the local tier has no failing exit

### Scenario: Multiple findings all print and record while the commit still exits zero

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unreachable evidence at push warns but never blocks

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Every reconciliation is durably recorded locally

### Scenario: Audit entries accumulate across boundary runs

- [x] RED 9891378
- [x] GREEN c794510
- [ ] REFACTOR

### Scenario: The audit record is created on first use when its directory is missing

- [x] RED 9891378
- [x] GREEN c794510
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
