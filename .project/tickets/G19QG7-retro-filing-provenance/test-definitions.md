# Test Definitions: Retro filing provenance and reconcile sweep

Feature source: `packages/cli/features/retro-filing-provenance.feature`

test-definitions.md is the R/G/R ledger.

Quality-review notes for RED (2026-07-06): the SM2.R5 scenario must assert the
list query's filter parameters (state=open, labels=retro) on the transport spy,
not merely the absence of comments — otherwise a sweep that lists everything but
skips these fixtures passes vacuously.

## Rule: retro-filing-provenance.SM1.R1 — Every encounter records environment-aware provenance, newest visible

### Scenario: A dogfood-session encounter records the safeword short HEAD SHA and capture time

- [x] RED f4241d3
- [x] GREEN 201bc3e
- [x] REFACTOR skip: resolver is a single small closure; wiring follows existing dependency-injection idiom

### Scenario: A customer-install encounter records the installed safeword version and capture time

- [x] RED skip: behavior shipped inside the dogfood scenario's GREEN (201bc3e) — the resolver's two branches are one function; staging a fake RED would be theater
- [x] GREEN 08819f6
- [x] REFACTOR skip: partition test only, no production change

### Scenario: A recurrence bump surfaces the newest encounter's provenance

- [x] RED e46e90c
- [x] GREEN b864165
- [x] REFACTOR skip: coercion helper follows the existing coerceHarness pattern — nothing to restructure

### Scenario: A recurrence bump onto a pre-provenance ledger preserves its counts and gains provenance

- [x] RED 0ba463f
- [x] GREEN f8b9a64
- [x] REFACTOR skip: minimal additive change — no duplication or naming drift introduced

### Scenario: Unresolvable git state never blocks filing

- [x] RED skip: fail-open shipped with the resolver (201bc3e); this proves the rejection path (throwing git runner) end to end
- [x] GREEN e1e7f0e
- [x] REFACTOR skip: test-only addition

## Rule: retro-filing-provenance.SM1.R2 — Provenance is code-assembled, bounded, and never carries a customer repo identifier

### Scenario: Customer-install provenance contains no customer repo identifier

- [x] RED skip: guard shipped with the resolver's customer branch (201bc3e); this scenario proves the negative space with a branch-shaped sentinel
- [x] GREEN e9fd7f9
- [x] REFACTOR skip: test-only addition

### Scenario: Attacker-shaped provenance in an upstream ledger is coerced, never echoed

- [x] RED 7baf5c1
- [x] GREEN 75d7cc7
- [x] REFACTOR skip: validation constants follow the module's existing coercion idiom

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
