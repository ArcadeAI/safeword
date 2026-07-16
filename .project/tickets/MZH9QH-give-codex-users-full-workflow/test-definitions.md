# Test Definitions: Give Codex users the full Safe Word workflow

Feature source: `packages/cli/features/give-codex-users-full-workflow.feature`

test-definitions.md is the R/G/R ledger.

## Rule: codex-workflow.TBU1.R1 - Complete workflow availability

### Scenario: Complete profile plugin exposes every workflow entry and phase reference

- [x] RED e0633ddc
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing phase material rejects the plugin release

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-workflow.TBU1.R2 - Project stays free of workflow material

### Scenario: Fresh setup keeps workflow material out of the project

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Project-local workflow output rejects the integration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-workflow.TBU1.R3 - Staged migration handoff

### Scenario: Initial plugin migration preserves legacy hooks and explains the handoff

- [x] RED 57971514
- [x] GREEN a7de06e5
- [x] REFACTOR skip: the shared migration fixture already centralizes exact legacy-byte preservation

### Scenario: Completed handoff removes only legacy Safe Word hooks

- [x] RED 04c93b26
- [x] GREEN 2263c57a
- [ ] REFACTOR

### Scenario: Initial migration does not clean up hooks without an explicit handoff request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Failed plugin installation retains legacy hooks

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: codex-workflow.TBU1.R4 - Untrusted hooks fail loudly

### Scenario: New plugin hooks require review before they run

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Changed plugin hooks require review again

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: workflow-maintenance.SWM1.R1 - Deterministic allowlisted generation

### Scenario: Allowed adaptations preserve workflow meaning

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Generated skill metadata fits Codex's documented fallback discovery budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Over-budget skill metadata rejects the plugin release

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unexpected workflow drift rejects generation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: workflow-maintenance.SWM1.R2 - Complete release package

### Scenario: Packed package contains the complete generated plugin

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing packed plugin asset rejects publication

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: workflow-maintenance.SWM1.R3 - Real cached installation

### Scenario: Cached installation exposes scoped workflow skills without project files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Project copies cannot mask a missing cached plugin asset

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: workflow-maintenance.SWM1.R4 - Safe Bunx-only hook commands

### Scenario: Plugin hooks invoke the pinned Safe Word CLI through Bunx

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Unsafe hook execution path rejects the plugin release

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
