# Test Definitions: Keep Codex protection continuous

Feature source: `packages/cli/features/keep-codex-protection-continuous.feature`

test-definitions.md is the R/G/R ledger.

## Rule: codex-continuity.TBU1.R1 — Generic project maintenance never retires working legacy Codex protection

### Scenario: Upgrade preserves recognized legacy protection

- [x] RED 977fb5dc2
- [x] GREEN 3b1defd39
- [x] REFACTOR 245e8607f

### Scenario: Plugin installation failure leaves repository protection unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Partial profile installation failure leaves repository protection unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-continuity.TBU1.R2 — Plugin readiness requires current hook-execution proof, not installation or enablement alone

### Scenario: Enabled plugin without proof remains unproven

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Successful installation requires a Codex restart

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plugin SessionStart clears restart-required state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Trusted plugin SessionStart records current proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Interrupted proof write cannot become current

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Changed plugin identity invalidates proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Legacy SessionStart cannot create plugin proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-continuity.TBU1.R3 — Coexistence executes exactly one authoritative implementation

### Scenario: Legacy handler remains authoritative for a covered event

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plugin covers an event missing from a partial legacy installation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plugin covers a configured legacy event with a broken runtime

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-continuity.TBU1.R4 — Shared cleanup is explicit, selective, recoverable, and idempotent

### Scenario: Finalization refuses stale proof without mutation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Declined interactive finalization leaves the repository unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Confirmed finalization creates a recoverable plugin-only project

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Failed finalization rolls back to the complete pre-migration state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Failed rollback retains recovery evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repeated finalization of a plugin-only project is a no-op

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repeated migration converges in every pre-finalization state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Migration remains blocked while recovery is required

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery restores the backed-up legacy state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery refuses to overwrite an intervening edit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Handled transaction failure restores the pre-migration state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Process crash leaves deterministic recovery evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unsafe backup targets are rejected before mutation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Deprecated cleanup alias follows the finalization contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Explicit non-interactive finalization succeeds

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-continuity.NTB1.R1 — Every migration state names protection and one next action

### Scenario: Human status gives one safe next action for settled migration states

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unproven plugin status reflects legacy protection

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery state takes precedence over legacy protection

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plugin-only human status has no next action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: JSON status separates machine output from diagnostics

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plugin-only JSON status exits successfully

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Status execution error has stable machine semantics

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: JSON status uses state-specific complete schema

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: JSON finalization plan uses stable effect actions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Finalized project setup state overrides disabled-profile detail

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-continuity.NTB1.R2 — Non-interactive use never performs shared cleanup without an explicit finalization flag

### Scenario: Non-interactive migration without complete confirmation cannot finalize

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-continuity.SWM1.R1 — Finalization removes only known Safe Word-owned legacy assets

### Scenario: Lookalike and user-authored assets survive finalization

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-continuity.SWM1.R2 — A finalized repository retains a small plugin-setup bootstrap without duplicated workflow policy

### Scenario: New teammate receives only the plugin setup path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Finalized project tells an unconfigured teammate to install the plugin

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Generic setup does not install the migration bootstrap

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
