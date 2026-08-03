# Test Definitions: Choose where Safeword runs in Claude

Feature source: `features/choose-claude-plugin-scope.feature`

test-definitions.md is the R/G/R ledger.

## Rule: choose-claude-plugin-scope.TBU1.R1 — Project scope is the predictable default while user scope remains an explicit supported choice

### Scenario: Fresh installation uses only the requested activation boundary

- [x] RED 13e6b0acb
- [x] GREEN 72a958ca4
- [x] REFACTOR skip: first slice is already a single typed scope path; validation and canonical identity belong to their pending rejection and reconciliation scenarios

### Scenario: Unsupported scope is rejected before mutation

- [x] RED 549663d9f
- [x] GREEN e3f6dcc33
- [x] REFACTOR skip: one catalog value kind and one defensive handler guard are the smallest clear validation boundary

## Rule: choose-claude-plugin-scope.TBU1.R2 — Installation and upgrade mutate only the selected scope and preserve unrelated state

### Scenario: An older official installation upgrades only in the selected scope

- [x] RED 710fb11f4
- [x] GREEN a167ccfa7
- [x] REFACTOR skip: pre-commit complexity enforcement already separated settings observation, trust checks, and convergence before GREEN; no further cleanup is warranted

### Scenario: First installation in one scope preserves an existing installation in the other

- [x] RED 08e405de3
- [x] GREEN 9a0235409
- [x] REFACTOR skip: overlap is a single derived count over the already-observed applicable entries; no new state or abstraction is needed

### Scenario: A disabled exact installation is enabled only in the selected scope

- [x] RED skip: selected-scope enablement was already delivered by the fresh scoped-install walking skeleton; the newly executable scenario passed immediately with both scopes
- [x] GREEN 58381070b
- [x] REFACTOR skip: the fixture reuses the established scoped-state model and no production change introduced duplication to remove

### Scenario: Unsafe selected-scope metadata is refused without an implicit downgrade

- [x] RED 2a21214f7
- [x] GREEN c7a1c1aff
- [x] REFACTOR skip: version safety is isolated in one classifier and failure presentation is centralized; no post-green duplication remains

### Scenario: Project installation preserves unrelated repository settings

- [x] RED skip: supported Claude commands already merge their owned declarations; the newly executable mixed-settings scenario passed immediately
- [x] GREEN 7de793545
- [x] REFACTOR skip: preservation is expressed by one reusable exclusion snapshot and direct ownership assertions; no production refactor was needed

### Scenario: User installation leaves the repository unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Selected-scope operation failure is reported without touching the other scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Postcondition verification failure reports completed selected-scope work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: choose-claude-plugin-scope.TBU1.R3 — Repeating installation in either scope is idempotent

### Scenario: Repeating an exact scoped installation is a no-op

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Damaged selected-scope cache is not mistaken for an idempotent installation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: choose-claude-plugin-scope.NTB1.R1 — Status identifies the applicable scope and reports overlap without silently removing protection

### Scenario: Status identifies one applicable installation for the current project

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Status reports no applicable installation for the current project

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Status reports overlapping applicable installations without changing either

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: choose-claude-plugin-scope.NTB1.R2 — Legacy cleanup proceeds only from one unambiguous applicable and proven installation

### Scenario: One proven applicable scope can authorize legacy cleanup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Proof that does not establish current-project execution cannot authorize cleanup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Overlapping scopes cannot authorize legacy cleanup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
