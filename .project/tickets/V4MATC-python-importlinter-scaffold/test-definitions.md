# Test Definitions: Python pack scaffolds a generic import-linter config

Feature source: `features/python-importlinter-scaffold.feature`

test-definitions.md is the R/G/R ledger.

## Rule: python-importlinter-scaffold.TB1.R1 — a freshly set-up Python project gets a working cycle check with zero manual configuration

### Scenario: setup scaffolds .importlinter for a flat single-package project

- [x] RED 6b29b74
- [x] GREEN 5e27063
- [x] REFACTOR skip: two small single-purpose functions + clean dispatch, no structural improvement needed

### Scenario: setup detects the package in a src layout

- [x] RED skip: behavior landed with scenario 1's minimal GREEN (src scan is part of detectSolePackage); test added as regression proof
- [x] GREEN 9ed2e86
- [x] REFACTOR skip: single assertion-focused test, nothing to restructure

### Scenario: the scaffolded check fails when a circular import is introduced

- [x] RED skip: asserts the real tool's verdict on the scenario-1 scaffold; no new implementation to fail first — E2E proof (cycle → exit 1 naming the contract) verified manually then pinned
- [x] GREEN 5d24c1f
- [x] REFACTOR skip: thin guarded spawns, nothing to restructure

## Rule: python-importlinter-scaffold.TB1.R2 — an existing import-linter configuration is never modified, duplicated, or overridden

### Scenario: setup and upgrade leave a project with existing import-linter config untouched (outline: 3 config forms × setup, 2 × upgrade)

- [x] RED 51fd266
- [x] GREEN 969e53c
- [x] REFACTOR skip: detector gained a small shared helper at GREEN; remaining rows are parameterized tests (08d6a90), nothing to restructure

## Rule: python-importlinter-scaffold.TB1.R3 — when the top-level package cannot be determined unambiguously, safeword scaffolds nothing

### Scenario: a scripts-only Python project gets no scaffold

- [x] RED skip: ambiguity fallback landed with scenario 1's minimal GREEN (detectSolePackage returns undefined for zero packages); regression proof added
- [x] GREEN 161c71b
- [x] REFACTOR skip: single focused test

### Scenario: a project with multiple top-level packages gets no scaffold (outline: 2 layouts × setup, 1 × upgrade)

- [x] RED skip: same fallback (2+ candidates → undefined) landed at scenario 1's GREEN; parameterized regression proofs added
- [x] GREEN 161c71b
- [x] REFACTOR skip: parameterized it.each, nothing to restructure

## Rule: python-importlinter-scaffold.TB1.R4 — the scaffold is create-once, then the user's: created when absent, never overwritten, reset removes only the unmodified

### Scenario: upgrade scaffolds .importlinter for a previously-set-up project that lacks one

- [x] RED skip: managedFiles already create-if-missing on upgrade (reconcile.ts planManagedFilesActions); regression proof added
- [x] GREEN 9f2db8e
- [x] REFACTOR skip: thin fixtures over shared helpers

### Scenario: upgrade is idempotent over an unmodified scaffold

- [x] RED skip: managedFiles skip existing files by design; regression proof added
- [x] GREEN 9f2db8e
- [x] REFACTOR skip: thin fixtures over shared helpers

### Scenario: upgrade preserves a user-extended scaffold

- [x] RED skip: same never-overwrite semantics; regression proof added
- [x] GREEN 9f2db8e
- [x] REFACTOR skip: thin fixtures over shared helpers

### Scenario: reset removes an unmodified safeword-scaffolded config

- [x] RED 9e29f2c
- [x] GREEN 31950b3
- [x] REFACTOR skip: extracted planConditionalManagedRemoval at GREEN to satisfy the complexity gate; already clean

### Scenario: reset preserves a user-extended scaffold

- [x] RED skip: preservation is the removeIfUnmodified comparison's no-match branch, landed with the machinery GREEN; regression proof added
- [x] GREEN 6252888
- [x] REFACTOR skip: thin fixtures over shared helpers

### Scenario: reset preserves a user-authored import-linter config

- [x] RED skip: same no-match branch (user file never equals the scaffold); regression proof added
- [x] GREEN 6252888
- [x] REFACTOR skip: thin fixtures over shared helpers

## Rule: python-importlinter-scaffold.TB1.R5 — import-linter is installed with the pack's other Python tools; a failed installation surfaces the install command

### Scenario: setup installs import-linter alongside the pack's other Python tools

- [x] RED 99c78da
- [x] GREEN 68e1dcf
- [x] REFACTOR skip: one-condition change threaded through existing flow

### Scenario: a failed installation surfaces the package-manager-appropriate install command

- [x] RED 99c78da
- [x] GREEN 68e1dcf
- [x] REFACTOR skip: guidance path pre-existing; only the tool list changed
