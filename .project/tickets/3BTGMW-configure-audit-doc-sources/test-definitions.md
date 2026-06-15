# Test Definitions: Configure Documentation Sources for Audit

Feature source: `features/configure-audit-doc-sources.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Configured sources are authoritative

### Scenario: Configured local documentation source is read as audit inventory

- [x] RED skip: backfilled after implementation; covered by documentation-sources unit and BDD tests
- [x] GREEN skip: backfilled after implementation; covered by documentation-sources unit and BDD tests
- [x] REFACTOR skip: parser and audit guidance were refactored before BDD backfill

### Scenario: Relative local documentation source resolves from the project root

- [x] RED skip: backfilled after implementation; covered by documentation-sources unit and BDD tests
- [x] GREEN skip: backfilled after implementation; covered by documentation-sources unit and BDD tests
- [x] REFACTOR skip: parser already centralizes project-root resolution

### Scenario: Malformed documentation source entries do not block valid siblings

- [x] RED skip: backfilled after implementation; covered by documentation-sources unit and BDD tests
- [x] GREEN skip: backfilled after implementation; covered by documentation-sources unit and BDD tests
- [x] REFACTOR skip: parser helper already isolates source-shape handling

## Rule: Missing source decision asks once

### Scenario: Audit prompts when no documentation source decision exists

- [x] RED skip: backfilled after implementation; prompt behavior covered by BDD and audit guidance assertions
- [x] GREEN skip: backfilled after implementation; prompt behavior covered by BDD and audit guidance assertions
- [x] REFACTOR skip: no separate structural cleanup needed after decision helper extraction

### Scenario: Explicit empty documentation sources suppress future prompts

- [x] RED skip: backfilled after implementation; explicit empty decision covered by unit and BDD tests
- [x] GREEN skip: backfilled after implementation; explicit empty decision covered by unit and BDD tests
- [x] REFACTOR skip: no separate structural cleanup needed after decision helper extraction

### Scenario: Explicit empty documentation sources use fallback discovery

- [x] RED skip: backfilled after implementation; fallback behavior covered by BDD and audit guidance assertions
- [x] GREEN skip: backfilled after implementation; fallback behavior covered by BDD and audit guidance assertions
- [x] REFACTOR skip: fallback remains audit guidance, not CLI validation logic

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: reviewed after BDD backfill; shared decision helper is the only needed abstraction
