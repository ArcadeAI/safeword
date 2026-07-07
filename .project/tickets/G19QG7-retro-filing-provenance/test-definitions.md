# Test Definitions: Retro filing provenance and reconcile sweep

Feature source: `packages/cli/features/retro-filing-provenance.feature`

test-definitions.md is the R/G/R ledger.

Quality-review notes for RED (2026-07-06): the SM2.R5 scenario must assert the
list query's filter parameters (state=open, labels=retro) on the transport spy,
not merely the absence of comments — otherwise a sweep that lists everything but
skips these fixtures passes vacuously.

## Rule: retro-filing-provenance.SM1.R1 — Every encounter records environment-aware provenance, newest visible

### Scenario: A dogfood-session encounter records the safeword short HEAD SHA and capture time

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A customer-install encounter records the installed safeword version and capture time

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A recurrence bump surfaces the newest encounter's provenance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A recurrence bump onto a pre-provenance ledger preserves its counts and gains provenance

- [x] RED 0ba463f
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unresolvable git state never blocks filing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-filing-provenance.SM1.R2 — Provenance is code-assembled, bounded, and never carries a customer repo identifier

### Scenario: Customer-install provenance contains no customer repo identifier

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Attacker-shaped provenance in an upstream ledger is coerced, never echoed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-filing-provenance.SM2.R1 — Reconcile flags an issue whose surface was touched after its newest recorded code state

### Scenario: A dogfood-provenance issue is flagged when its surface changed after the capture time

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A version-provenance issue is flagged when its surface changed after that release's tag date

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A mixed ledger keys on the newest code state, not the newest wall clock

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An issue whose surface is untouched since its newest code state is not flagged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-filing-provenance.SM2.R2 — Reconcile only flags; it never closes

### Scenario: Flagging leaves the issue open and touches nothing but a comment and label

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-filing-provenance.SM2.R3 — Reconcile is idempotent

### Scenario: A re-run against unchanged state adds no duplicate flags

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-filing-provenance.SM2.R4 — Unreconcilable issues are left untouched

### Scenario: A version whose release-tag date cannot be resolved is skipped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An issue without recorded provenance is skipped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A process-surfaced issue is skipped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-filing-provenance.SM2.R5 — The sweep considers only open, retro-labeled issues

### Scenario: Closed and non-retro issues are never considered

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-filing-provenance.SM2.R6 — The sweep bounds its API operations per run, and applied flags land complete

### Scenario: A run over more flaggable issues than the bound flags completely up to it and defers the rest

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-filing-provenance.SM2.R7 — A per-issue transport failure never sinks the sweep or flags on partial data

### Scenario: A failing surface-commits query isolates to its issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
