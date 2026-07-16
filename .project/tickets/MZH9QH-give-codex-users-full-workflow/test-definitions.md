# Test Definitions: Give Codex users the full Safe Word workflow

Feature source: `packages/cli/features/give-codex-users-full-workflow.feature`

test-definitions.md is the R/G/R ledger.

## Rule: codex-workflow.TBU1.R1 - Complete workflow availability

### Scenario: Complete profile plugin exposes every workflow entry and phase reference

- [x] RED e0633ddc
- [x] GREEN 890367e2; live isolation 36d61247
- [x] REFACTOR skip: the generated catalogue, packed-package, and cache helpers are shared release contracts

### Scenario: Missing phase material rejects the plugin release

- [x] RED b7b0d9a1
- [x] GREEN 0779e386
- [x] REFACTOR skip: exact checked-in asset comparison is already isolated in the catalogue contract

## Rule: codex-workflow.TBU1.R2 - Project stays free of workflow material

### Scenario: Fresh setup keeps workflow material out of the project

- [x] RED observed 2026-07-16 before 6e5492f3: setup created an empty `.codex` directory
- [x] GREEN 6e5492f3
- [x] REFACTOR 47f89f44: acceptance binding invokes the public setup command and one shared project-tree assertion

### Scenario: Project-local workflow output rejects the integration

- [x] RED characterization: the plugin-only schema already prohibited project output; the fixture creates the forbidden tree deliberately
- [x] GREEN 47f89f44
- [x] REFACTOR skip: the negative case shares `assertNoProjectWorkflowTree` with the public-setup scenario

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

- [x] RED 57971514
- [x] GREEN 8d6285c1
- [x] REFACTOR a7de06e5: shared migration fixture preserves exact legacy-hook bytes across the initial-handoff scenarios

### Scenario: Failed plugin installation retains legacy hooks

- [x] RED c79ec903
- [x] GREEN 4b84db17
- [x] REFACTOR a7de06e5: the same real CLI fixture exercises failure without a test-only implementation seam

## Rule: codex-workflow.TBU1.R4 - Untrusted hooks fail loudly

### Scenario: New plugin hooks require review before they run

- [x] RED manual baseline: Codex trust UI is an external product behavior, so the no-bypass marker probe is characterization evidence
- [x] GREEN 110f2b9e; live smoke 890367e2
- [x] REFACTOR skip: interactive TUI evidence stays in one manual-acceptance procedure; automated marker absence remains in the live smoke

### Scenario: Changed plugin hooks require review again

- [x] RED manual baseline: mutating the actual cached hook definition is required to exercise Codex's renewed-review behavior
- [x] GREEN 110f2b9e
- [x] REFACTOR skip: both manual paths share the retained cache-only fixture and `/hooks` procedure

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

- [x] RED characterization: `assertCodexPluginCatalogue` already compared exact output; the BDD fixture mutates a non-allowlisted reference
- [x] GREEN 47f89f44
- [x] REFACTOR skip: one exact catalogue comparison owns missing, extra, and changed-asset detection

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

- [x] RED characterization: committed hooks already used the Bunx form; the release contract made that public boundary executable
- [x] GREEN 5d358196
- [x] REFACTOR 6e5492f3: extracted the shared hook-command policy for release and Cucumber contracts

### Scenario Outline: Unsafe hook execution path rejects the plugin release

- [x] RED 5d358196
- [x] GREEN 5d358196
- [x] REFACTOR 6e5492f3: shared policy rejects `npx`, unpinned Bunx, and trust-bypass variants

## Cross-scenario refactor

- [x] cross-scenario 6e5492f3: centralized pinned-Bunx hook validation for release and BDD coverage
