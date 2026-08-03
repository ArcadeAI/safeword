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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: First installation in one scope preserves an existing installation in the other

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A disabled exact installation is enabled only in the selected scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unsafe selected-scope metadata is refused without an implicit downgrade

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Project installation preserves unrelated repository settings

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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
