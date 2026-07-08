# Test Definitions: Boundary reconciliation gate (slice 1)

Feature source: `features/boundary-reconciliation-gate.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.

## Rule: A commit touching ticket artifacts gets its evidence reconciled and recorded

### Scenario: A staged ticket change with clean evidence passes quietly and is recorded

- [x] RED 9891378
- [x] GREEN c794510
- [x] REFACTOR 6fc7c6c

### Scenario: A staged forward phase advance without an anchor is warned and recorded

- [x] RED skip: emerged green from slice-1 engine composition
- [x] GREEN 5ab57b6
- [x] REFACTOR 6fc7c6c

### Scenario: A feature ticket at rest born past intake is warned at the boundary

- [x] RED 3eeed2c
- [x] GREEN 5ab57b6
- [x] REFACTOR 6fc7c6c

### Scenario: A staged ticket.md with unparseable frontmatter is warned, never crashed on

- [x] RED 3eeed2c
- [x] GREEN 5ab57b6
- [x] REFACTOR 6fc7c6c

### Scenario: Several tickets in one commit are each reconciled with verdicts grouped per ticket

- [x] RED skip: emerged green from slice-1 engine composition
- [x] GREEN 5ab57b6
- [x] REFACTOR 6fc7c6c

### Scenario: An invalid ledger annotation is warned at the commit boundary

- [x] RED 3eeed2c
- [x] GREEN 5ab57b6
- [x] REFACTOR 6fc7c6c

### Scenario: A feature ticket whose ledger is absent entirely is warned

- [x] RED 3eeed2c
- [x] GREEN 5ab57b6
- [x] REFACTOR 6fc7c6c

### Scenario: A malformed evidence artifact is warned about by name

- [x] RED 3eeed2c
- [x] GREEN 5ab57b6
- [x] REFACTOR 6fc7c6c

### Scenario: The commit tier consults no git history — a legacy SHA anchor is warned toward the path grammar

<!-- Retitled by HGYGND (artifact-content anchors): the commit tier now fully
verifies path anchors against the staged tree; a hex anchor draws the
migrate-to-path warning instead of waiting for push-tier reachability. -->

- [x] RED skip: guard pinned by construction — commit tier never builds a resolver
- [x] GREEN be37070
- [x] REFACTOR 6fc7c6c

### Scenario: A mixed commit of source files and one ticket artifact is reconciled, not silent

- [x] RED skip: emerged green from slice-1 engine composition
- [x] GREEN 5ab57b6
- [x] REFACTOR 6fc7c6c

## Rule: A push additionally verifies evidence against reachable history

### Scenario: An anchored artifact missing from the pushed tree is warned

<!-- Retitled by HGYGND: anchors are artifact paths verified against the tree;
the unreachable-SHA phrasing (and its forge/shallow-clone hedge) is gone. -->

- [x] RED 701a2b7
- [x] GREEN ea71278
- [x] REFACTOR 6fc7c6c

### Scenario: Anchors recorded before a rebase still verify after it

- [x] RED skip: protective test — passed pre-resolver, guards canonicalization once reachability landed
- [x] GREEN ea71278
- [x] REFACTOR 6fc7c6c

### Scenario: Only the entered phase's anchor is demanded on a multi-phase advance

- [x] RED skip: pure entered-phase logic shipped in #809; test protective from birth
- [x] GREEN ea71278
- [x] REFACTOR 6fc7c6c

### Scenario: Ledger step SHAs are verified against the pushed history

- [x] RED 701a2b7
- [x] GREEN ea71278
- [x] REFACTOR 6fc7c6c

### Scenario: A failing artifact read is recorded as indeterminate, never a crash

<!-- Retitled by HGYGND: the anchor check's failure seam is the artifact
reader; the ledger's SHA-resolution indeterminate case stays pinned in
boundary-engine.test.ts. -->

- [x] RED skip: unit-level spec written with its implementation in one slice (pure engine seam)
- [x] GREEN ea71278
- [x] REFACTOR 6fc7c6c

### Scenario: A branch pushed for the first time still gets its outgoing work reconciled

- [x] RED 701a2b7
- [x] GREEN ea71278
- [x] REFACTOR 6fc7c6c

## Rule: The gate is silent and free for changes that touch no ticket artifacts

### Scenario: A commit touching only source code produces no output and no audit entry

- [x] RED 9891378
- [x] GREEN c794510
- [x] REFACTOR 6fc7c6c

### Scenario: A push whose outgoing range contains no ticket-artifact changes is a silent no-op

- [x] RED 9891378
- [x] GREEN c794510
- [x] REFACTOR 6fc7c6c

### Scenario: Outside a safeword project the command is a silent no-op

- [x] RED 9891378
- [x] GREEN c794510
- [x] REFACTOR 6fc7c6c

## Rule: Findings never block — the local tier has no failing exit

### Scenario: Multiple findings all print and record while the commit still exits zero

- [x] RED 3eeed2c
- [x] GREEN 5ab57b6
- [x] REFACTOR 6fc7c6c

### Scenario: Unreachable evidence at push warns but never blocks

- [x] RED 701a2b7
- [x] GREEN ea71278
- [x] REFACTOR 6fc7c6c

## Rule: Every reconciliation is durably recorded locally

### Scenario: Audit entries accumulate across boundary runs

- [x] RED 9891378
- [x] GREEN c794510
- [x] REFACTOR 6fc7c6c

### Scenario: The audit record is created on first use when its directory is missing

- [x] RED 9891378
- [x] GREEN c794510
- [x] REFACTOR 6fc7c6c

## Feature-level cross-scenario refactor

- [x] cross-scenario 6fc7c6c
