# Test Definitions: Give Codex users the full Safe Word workflow

Feature source: `packages/cli/features/give-codex-users-full-workflow.feature`

test-definitions.md is the R/G/R ledger.

## Rule: codex-workflow.TBU1.R1 - Complete workflow availability

### Scenario: Complete profile plugin exposes every workflow entry and phase reference

- [x] RED e0633ddc
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing phase material rejects the plugin release

- [x] RED b7b0d9a1
- [x] GREEN 0779e386
- [x] REFACTOR skip: exact checked-in asset comparison is already isolated in the catalogue contract

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
- [x] REFACTOR skip: GREEN decomposed scanner, block classification, and durable file operations into focused helpers

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

- [x] RED 5c6996c8
- [x] GREEN 6c46b259
- [x] REFACTOR skip: parsing, transformation, and output formatting remain independently named helpers

### Scenario: Generated skill metadata fits Codex's documented fallback discovery budget

- [x] RED b7b0d9a1
- [x] GREEN 0779e386
- [x] REFACTOR skip: budget measurement is a small pure helper shared by source and release contracts

### Scenario: Over-budget skill metadata rejects the plugin release

- [x] RED b7b0d9a1
- [x] GREEN 0779e386
- [x] REFACTOR skip: the contract injects only metadata and exercises the production budget guard directly

### Scenario: Unexpected workflow drift rejects generation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: workflow-maintenance.SWM1.R2 - Complete release package

### Scenario: Packed package contains the complete generated plugin

- [x] RED 1c047ebf
- [x] GREEN 92f5b4c1
- [x] REFACTOR skip: archive packing, extraction, and package validation are independently reusable helpers

### Scenario: Missing packed plugin asset rejects publication

- [x] RED 1c047ebf
- [x] GREEN 92f5b4c1
- [x] REFACTOR skip: the deletion case calls the same archive validation path used for the real tarball

## Rule: workflow-maintenance.SWM1.R3 - Real cached installation

### Scenario: Cached installation exposes scoped workflow skills without project files

- [x] RED 9b7065d2
- [x] GREEN 890367e2
- [x] REFACTOR skip: cache-path parsing and complete cache validation are separate reusable helpers

### Scenario: Project copies cannot mask a missing cached plugin asset

- [x] RED 9b7065d2
- [x] GREEN 26435864
- [x] REFACTOR skip: the deterministic fixture directly proves the negative case without a live model dependency

## Rule: workflow-maintenance.SWM1.R4 - Safe Bunx-only hook commands

### Scenario: Plugin hooks invoke the pinned Safe Word CLI through Bunx

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Unsafe hook execution path rejects the plugin release

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Cross-scenario refactor

- [ ] cross-scenario
