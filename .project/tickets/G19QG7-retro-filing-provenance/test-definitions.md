# Test Definitions: Retro filing provenance and reconcile sweep

Feature source: `packages/cli/features/retro-filing-provenance.feature`

test-definitions.md is the R/G/R ledger.

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
