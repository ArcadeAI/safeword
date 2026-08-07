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

### Scenario: Enabled older plugin requires an update

- [x] RED skip: version-aware observation arrived with the state-table regression
- [x] GREEN b49622008
- [x] REFACTOR skip: update-required is one ordered state-table row

### Scenario: Successful installation requires an app restart

- [x] RED 7ceb02372
- [x] GREEN 240a0b432
- [x] REFACTOR skip: durable profile writer is already isolated behind one function

### Scenario: Plugin SessionStart from the installing app does not clear activation state

- [x] RED skip: the earlier clearing expectation was invalidated by same-host catalogue evidence
- [x] GREEN 1e7968133
- [x] REFACTOR skip: host identity is checked at the single activation boundary

### Scenario: Trusted plugin SessionStart records event-specific proof

- [x] RED skip: proof identity shipped inseparably with activation-host validation
- [x] GREEN 1e7968133
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

- [x] RED e0d126f5d
- [x] GREEN e57bee71b
- [x] REFACTOR skip: explicit recovery and automatic rollback share restoreBeforeImage

### Scenario: Recovery refuses to overwrite an intervening edit

- [x] RED skip: conflict checking shipped inseparably with the recovery reader
- [x] GREEN d1f5c72e2
- [x] REFACTOR skip: all entries are preflighted before recovery changes status or files

### Scenario: Handled transaction failure restores the pre-migration state

- [x] RED skip: handled-failure rollback shipped with the transaction rollback boundary
- [x] GREEN 6b8010a4c
- [x] REFACTOR skip: handled failures preserve and rethrow the original error object

### Scenario: Process crash leaves deterministic recovery evidence

- [x] RED 4a6074754
- [x] GREEN 81634faee
- [x] REFACTOR skip: the durable prepared manifest is the single crash-resume boundary

### Scenario: Unsafe backup targets are rejected before mutation

- [x] RED 943a4af05
- [x] GREEN 81b5d6b23
- [x] REFACTOR skip: containment and symlink checks share assertSafeComponents

### Scenario: Deprecated cleanup alias follows the finalization contract

- [x] RED skip: the alias is parsed into the same finalization branch
- [x] GREEN 4cf30d883
- [x] REFACTOR skip: the alias shares the canonical finalization implementation

### Scenario: Explicit non-interactive finalization succeeds

- [x] RED skip: the confirmation resolver and transaction boundary already fail independently
- [x] GREEN 42162b634
- [x] REFACTOR skip: the canonical finalization path already owns confirmation and transaction ordering

## Rule: codex-continuity.NTB1.R1 — Every migration state names protection and one next action

### Scenario: Human status gives one safe next action for settled migration states

- [x] RED skip: the typed state table already existed before its complete human-render characterization
- [x] GREEN fa87779b0
- [x] REFACTOR skip: state derivation and human rendering remain separate pure functions

### Scenario: Unproven plugin status reflects legacy protection

- [x] RED efd4a252f
- [x] GREEN 03f146a37
- [x] REFACTOR skip: status reuses the event-level compatibility authority predicate

### Scenario: Recovery state takes precedence over legacy protection

- [x] RED skip: recovery precedence shipped with the transaction recovery gate
- [x] GREEN b2ca0fcd7
- [x] REFACTOR skip: recovery remains the first ordered migration-state rule

### Scenario: Plugin-only human status has no next action

- [x] RED skip: plugin settled-state rendering existed before its end-to-end characterization
- [x] GREEN 9508ca2fc
- [x] REFACTOR skip: absence of next_actions already drives omission of the human Next line

### Scenario: JSON status separates machine output from diagnostics

- [x] RED skip: status already selected one renderer before the stdout-purity characterization
- [x] GREEN a74c34bb6
- [x] REFACTOR skip: JSON serialization remains a single direct stdout write

### Scenario: Plugin-only JSON status exits successfully

- [x] RED skip: the shared result exit-code function already treated plugin state as successful
- [x] GREEN 7a0e854dc
- [x] REFACTOR skip: human and JSON status share the same state and exit-code result

### Scenario: Status execution error has stable machine semantics

- [x] RED 0a8e46df7
- [x] GREEN db7068def
- [x] REFACTOR skip: observation failures now enrich the same complete result object

### Scenario: JSON status uses state-specific complete schema

- [x] RED skip: the versioned result type existed before exhaustive shape characterization
- [x] GREEN dafac16e8
- [x] REFACTOR skip: every state is emitted through one schema-1 envelope with one nested schema-2 migration object

### Scenario: Next-action shape distinguishes a runnable command from a human step

- [x] RED f03c07d22
- [x] GREEN f03c07d22
- [x] REFACTOR skip: the tagged union is the minimal machine-readable distinction

### Scenario: JSON finalization plan uses stable effect actions

- [x] RED 5f355693b
- [x] GREEN b862e9765
- [x] REFACTOR skip: preview and execution share the canonical mutation planner

### Scenario: Finalized project setup state overrides disabled-profile detail

- [x] RED 16bafbcfe
- [x] GREEN d3cf40ebc
- [x] REFACTOR skip: finalized setup remains one ordered state predicate

## Rule: codex-continuity.NTB1.R2 — Non-interactive use never performs shared cleanup without an explicit finalization flag

### Scenario: Non-interactive migration without complete confirmation cannot finalize

- [x] RED skip: missing confirmation already failed closed before repository mutation
- [x] GREEN 913b14ee5
- [x] REFACTOR skip: one confirmation resolver gates every finalization alias

## Rule: codex-continuity.SWM1.R1 — Finalization removes only known Safe Word-owned legacy assets

### Scenario: Lookalike and user-authored assets survive finalization

- [x] RED 28a2effe9
- [x] GREEN 06cf98243
- [x] REFACTOR skip: the hook-script map now derives the cleanup inventory without a duplicate allowlist

## Rule: codex-continuity.SWM1.R2 — A finalized repository retains a small plugin-setup bootstrap without duplicated workflow policy

### Scenario: New teammate receives only the plugin setup path

- [x] RED 54efb34f6
- [x] GREEN b0fe27b9a
- [x] REFACTOR skip: bootstrap remains one setup-only generated mutation

### Scenario: Finalized project tells an unconfigured teammate to install the plugin

- [x] RED d9911344e
- [x] GREEN e7c7da2d3
- [x] REFACTOR skip: setup guidance is state-specific while Next remains one exact command

### Scenario: Generic setup does not install the migration bootstrap

- [x] RED skip: the bootstrap was never registered as a generic managed template
- [x] GREEN 880b5245b
- [x] REFACTOR skip: finalization remains the bootstrap's only creation path

## Feature-level cross-scenario refactor

- [x] cross-scenario 43b87f0c6
