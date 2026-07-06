# Test Definitions: Python pack scaffolds a generic import-linter config

Feature source: `features/python-importlinter-scaffold.feature`

test-definitions.md is the R/G/R ledger.

## Rule: python-importlinter-scaffold.TB1.R1 — a freshly set-up Python project gets a working cycle check with zero manual configuration

### Scenario: setup scaffolds .importlinter for a flat single-package project

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: setup detects the package in a src layout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: the scaffolded check fails when a circular import is introduced

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: python-importlinter-scaffold.TB1.R2 — an existing import-linter configuration is never modified, duplicated, or overridden

### Scenario: setup and upgrade leave a project with existing import-linter config untouched (outline: 3 config forms × setup, 2 × upgrade)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: python-importlinter-scaffold.TB1.R3 — when the top-level package cannot be determined unambiguously, safeword scaffolds nothing

### Scenario: a scripts-only Python project gets no scaffold

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: a project with multiple top-level packages gets no scaffold

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: python-importlinter-scaffold.TB1.R4 — the scaffold is create-once, then the user's: created when absent, never overwritten, reset removes only the unmodified

### Scenario: upgrade scaffolds .importlinter for a previously-set-up project that lacks one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade is idempotent over an unmodified scaffold

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: upgrade preserves a user-extended scaffold

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: reset removes an unmodified safeword-scaffolded config

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: reset preserves a user-extended scaffold

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: reset preserves a user-authored import-linter config

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: python-importlinter-scaffold.TB1.R5 — safeword never installs the tool; it surfaces the package-manager-appropriate install command

### Scenario: setup surfaces install guidance without installing (outline: uv / pip)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: no install guidance when the tool is already present

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
