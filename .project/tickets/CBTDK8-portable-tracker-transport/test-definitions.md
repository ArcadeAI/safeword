# Test Definitions: Environment-portable tracker transport

Feature source: `features/portable-tracker-transport.feature`

test-definitions.md is the R/G/R ledger. Behavior lives in the `.feature`; proof is via
vitest unit tests over the pure plan + apply-results functions (no live tracker, #363).

## Rule: --plan emits the right intent for each ticket's sync state

### Scenario: A never-synced ticket becomes a create intent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An already-recorded ticket becomes an update intent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A terminal ticket becomes a close intent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: --plan carries the ticket graph by ticket id

### Scenario: A ticket with a parent carries a parent edge

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocked ticket carries blocked-by edges

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An edge to a ticket outside the corpus is dropped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: --plan runs offline

### Scenario: Planning needs no credential and contacts no tracker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: --apply-results folds executor results into the map idempotently

### Scenario: A create result is recorded with its issue number and url

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Re-applying the same results changes nothing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An update or close result makes no identity change

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Malformed results are rejected without corrupting the map

### Scenario Outline: A malformed results file is rejected and the map is left intact

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A planned create round-trips through results back into the map

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The new modes are additive; the gh path is unchanged

### Scenario: Running sync-tracker with no mode flag projects via the existing path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plan and apply modes cannot be combined

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Egress discipline is preserved

### Scenario: A create intent body carries only minimal egress

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The emitted plan contains no credential

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
