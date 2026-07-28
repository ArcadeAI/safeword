# Test Definitions: Keep Codex protection continuous

Feature source: `packages/cli/features/keep-codex-protection-continuous.feature`

test-definitions.md is the R/G/R ledger.

## Rule: codex-continuity.TBU1.R1 — Generic project maintenance never retires working legacy Codex protection

### Scenario: Upgrade preserves recognized legacy protection

- [x] RED 977fb5dc2
- [x] GREEN 3b1defd39
- [x] REFACTOR 245e8607f

### Scenario: Plugin installation failure leaves repository protection unchanged

- [x] RED 8d6b92c4d
- [x] GREEN c9f4baba0
- [x] REFACTOR skip: command branch is already the minimal safe expansion

### Scenario: Partial profile installation failure leaves repository protection unchanged

- [x] RED 1a8fbee40
- [x] GREEN c21c27987
- [x] REFACTOR skip: shared verification boundary already distinguishes installation context

## Rule: codex-continuity.TBU1.R2 — Plugin readiness requires current hook-execution proof, not installation or enablement alone

### Scenario: Enabled plugin without proof remains unproven

- [x] RED f586883b6
- [x] GREEN ff5d4270f
- [x] REFACTOR skip: ordered state table is already the minimal precedence model

### Scenario: Successful installation requires a Codex restart

- [x] RED 7ceb02372
- [x] GREEN 240a0b432
- [x] REFACTOR skip: durable profile writer is already isolated behind one function

### Scenario: Plugin SessionStart clears restart-required state

- [x] RED 8757aee8e
- [x] GREEN d8e9dc757
- [x] REFACTOR skip: proof and marker writes already share one atomic JSON primitive

### Scenario: Trusted plugin SessionStart records current proof

- [x] RED skip: complete proof is inseparable from safely clearing the restart marker
- [x] GREEN d8e9dc757
- [x] REFACTOR skip: proof payload has one schema-owned writer

### Scenario: Interrupted proof write cannot become current

- [x] RED a88288036
- [x] GREEN 84bcc5060
- [x] REFACTOR skip: marker and proof durability already share the cleaned-up primitive

### Scenario: Changed plugin identity invalidates proof

- [x] RED skip: proof validation shipped with proof-aware status before corruption table coverage
- [x] GREEN 569769919
- [x] REFACTOR skip: proof validation is already centralized in observeCodexHookProof

### Scenario: Legacy SessionStart cannot create plugin proof

- [x] RED skip: provenance gating shipped inseparably with the plugin proof writer
- [x] GREEN 707f1235d
- [x] REFACTOR skip: plugin provenance remains a single hidden CLI boundary

## Rule: codex-continuity.TBU1.R3 — Coexistence executes exactly one authoritative implementation

### Scenario: Legacy handler remains authoritative for a covered event

- [x] RED 47057886b
- [x] GREEN b9ffe5e72
- [x] REFACTOR skip: authority now has one schema-driven event predicate

### Scenario: Plugin covers an event missing from a partial legacy installation

- [x] RED skip: missing-event fallback is inseparable from event-scoped authority
- [x] GREEN 5180b5ac2
- [x] REFACTOR skip: fallback is the absence of event authority, with no second path

### Scenario: Plugin covers a configured legacy event with a broken runtime

- [x] RED skip: runtime viability shipped inseparably with event authority
- [x] GREEN ad77b29b5
- [x] REFACTOR skip: runtime failure feeds the same fail-open authority predicate

## Rule: codex-continuity.TBU1.R4 — Shared cleanup is explicit, selective, recoverable, and idempotent

### Scenario: Finalization refuses stale proof without mutation

- [x] RED 24c1d4fec
- [x] GREEN f6b6fdf3e
- [x] REFACTOR skip: proof validation remains the single profile-proof observer

### Scenario: Declined interactive finalization leaves the repository unchanged

- [x] RED 4c27ed9d1
- [x] GREEN 46a4a9c09
- [x] REFACTOR skip: confirmation is isolated as a pure pre-mutation gate

### Scenario: Confirmed finalization creates a recoverable plugin-only project

- [x] RED 23a30fd26
- [x] GREEN c7433666c
- [x] REFACTOR skip: planning, backup, and application are already isolated in finalization.ts

### Scenario: Failed finalization rolls back to the complete pre-migration state

- [x] RED f69171c2c
- [x] GREEN b323f79d3
- [x] REFACTOR skip: rollback reuses the same validated backup images as recovery

### Scenario: Failed rollback retains recovery evidence

- [x] RED 682e244cc
- [x] GREEN 7314d9302
- [x] REFACTOR skip: failure evidence reuses the prepared manifest without another state model

### Scenario: Repeated finalization of a plugin-only project is a no-op

- [x] RED 9eb230dcc
- [x] GREEN 44ad4b3dc
- [x] REFACTOR skip: settled-state recognition is centralized in codexFinalizationIsComplete

### Scenario: Repeated migration converges in every pre-finalization state

- [x] RED 44ded1b5a
- [x] GREEN 7d9c031ce
- [x] REFACTOR skip: restart-marker validation is shared by status and migration

### Scenario: Migration remains blocked while recovery is required

- [x] RED aed49bcf2
- [x] GREEN 613cd044d
- [x] REFACTOR skip: one recovery predicate gates both status and mutation

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
