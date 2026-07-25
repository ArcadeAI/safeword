# Test Definitions: Environment-portable tracker transport

Feature source: `features/portable-tracker-transport.feature`

test-definitions.md is the R/G/R ledger. Behavior lives in the `.feature`; proof is via
vitest unit tests over the pure plan + apply-results functions, plus wiring tests through the
real `sync-tracker` command for the `--plan`/`--apply-results` flags (no live tracker, #363).

## Rule: --plan emits the right intent for each ticket's sync state

### Scenario: A never-synced ticket becomes a create intent

- [x] RED skip: combined with GREEN in 2e1d42c (early slice — RED+GREEN one commit; separated from slice 3 on)
- [x] GREEN 2e1d42c
- [x] REFACTOR skip: none needed

### Scenario: An already-recorded ticket becomes an update intent

- [x] RED skip: combined with GREEN in 4b5fc89 (early slice — RED+GREEN one commit; separated from slice 3 on)
- [x] GREEN 4b5fc89
- [x] REFACTOR skip: none needed

### Scenario: A terminal ticket becomes a close intent

- [x] RED skip: combined with GREEN in 4b5fc89 (early slice — RED+GREEN one commit; separated from slice 3 on)
- [x] GREEN 4b5fc89
- [x] REFACTOR skip: none needed

### Scenario: An empty corpus yields an empty but valid plan

- [x] RED skip: combined with GREEN in 2e1d42c (early slice — RED+GREEN one commit; separated from slice 3 on)
- [x] GREEN 2e1d42c
- [x] REFACTOR skip: none needed

## Rule: --plan carries the ticket graph by ticket id

### Scenario: A ticket with a parent carries a parent edge

- [x] RED afb5108
- [x] GREEN a3a92a9
- [x] REFACTOR skip: shared-helper extraction folded into GREEN

### Scenario: A blocked ticket carries its blocked-by edges as a set

- [x] RED afb5108
- [x] GREEN a3a92a9
- [x] REFACTOR skip: shared-helper extraction folded into GREEN

### Scenario: A ticket with both a parent and a blocked-by edge carries both

- [x] RED afb5108
- [x] GREEN a3a92a9
- [x] REFACTOR skip: shared-helper extraction folded into GREEN

### Scenario: Only the unresolvable edge is dropped; resolvable edges remain

- [x] RED afb5108
- [x] GREEN a3a92a9
- [x] REFACTOR skip: shared-helper extraction folded into GREEN

## Rule: --plan runs offline

### Scenario: Planning needs no credential and contacts no tracker

- [x] RED skip: computePlan is pure (no credential/client param) — structurally offline
- [x] GREEN dcf20aa
- [x] REFACTOR skip: none needed

## Rule: --apply-results folds executor results into the map idempotently

### Scenario: A create result is recorded with its issue number and url

- [x] RED 0cac69f
- [x] GREEN b73d7a4
- [x] REFACTOR skip: none needed

### Scenario: Re-applying the same results changes nothing

- [x] RED 0cac69f
- [x] GREEN b73d7a4
- [x] REFACTOR skip: none needed

### Scenario: An update or close result makes no identity change

- [x] RED 0cac69f
- [x] GREEN b73d7a4
- [x] REFACTOR skip: none needed

## Rule: Malformed results are rejected without corrupting the map

### Scenario Outline: A malformed results file is rejected and the map is left intact

- [x] RED 0cac69f
- [x] GREEN b73d7a4
- [x] REFACTOR skip: none needed

<!-- Unit-covered: bad JSON, unsupported version, missing number, missing url,
url-tail!=number, ticketId-not-in-corpus. The "absent from disk" example is an
fs concern covered by the --apply-results command wiring test (slice 5). -->

### Scenario: A planned create round-trips through results back into the map

- [x] RED skip: emergent from computePlan (slice 2) + applyResults (slice 4)
- [x] GREEN ff90189
- [x] REFACTOR skip: none needed

## Rule: The command surface is wired — stdout contract and mode routing

### Scenario: --plan writes a valid SyncPlan to stdout and nothing else

- [x] RED dc1b66a
- [x] GREEN dcf20aa
- [x] REFACTOR skip: none needed

### Scenario: With no mode flag, the command routes to the gh path

- [x] RED skip: no-flag path is the pre-existing gh path (command-egress.test.ts covers it)
- [x] GREEN dcf20aa
- [x] REFACTOR skip: none needed

### Scenario: Plan and apply modes cannot be combined

- [x] RED dc1b66a
- [x] GREEN dcf20aa
- [x] REFACTOR skip: none needed

## Rule: Egress discipline is preserved

### Scenario: A create intent body carries only minimal egress

- [x] RED skip: buildPayload minimal-body is unit-tested (payload.test.ts); computePlan uses it
- [x] GREEN dcf20aa
- [x] REFACTOR skip: none needed

### Scenario: The emitted plan contains no credential

- [x] RED skip: structural (plan built from corpus+map only)
- [x] GREEN ed66f9c
- [x] REFACTOR skip: none needed

## Cross-scenario

- [x] cross-scenario skip: scenarios are independent (pure functions + a stateless command surface); no cross-scenario refactor emerged
