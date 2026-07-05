# Test Definitions: Managed-file provenance refresh (#849)

Feature source: `features/managed-file-refresh.feature`

test-definitions.md is the R/G/R ledger.

## Rule: managed-file-refresh.TB1.R1 — an upgrade brings every pristine managed file to current resolved output

### Scenario: Setup records provenance for the managed files it writes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Setup on a clone of an installed project preserves existing provenance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pristine static managed file is refreshed when its template changes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A deleted managed file is recreated and regains provenance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unrecorded file that differs from resolved output is not brought current

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: managed-file-refresh.TB1.R2 — every refresh is reported; no managed file changes silently

### Scenario: Upgrade output names each refreshed managed file

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Diff previews a pending refresh without writing it

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: managed-file-refresh.TB1.R3 — a managed file already at current output is never rewritten

### Scenario: A pristine, current managed file is left unwritten on upgrade

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: managed-file-refresh.TB2.R1 — upgrade never rewrites a managed file whose bytes differ from safeword's recorded write

### Scenario: A customized managed file survives a shipped change untouched

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: managed-file-refresh.TB2.R2 — pristine status is re-derived from on-disk bytes at every upgrade

### Scenario: An edit made after an earlier refresh protects the file on the next upgrade

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: managed-file-refresh.TB2.R3 — no manifest state survives uninstall or reset

### Scenario Outline: Reset removes the provenance manifest in either mode

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: managed-file-refresh.SM1.R1 — provenance covers generator output as well as static templates

### Scenario: A pristine generated toolchain config is refreshed when its generator output changes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A config whose generator now resolves nothing is left untouched

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: managed-file-refresh.SM1.R2 — byte-identity to current resolved output is the only adoption path into provenance

### Scenario: A pre-manifest file identical to resolved output gains provenance without a write

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A file matching resolved output but not its record has its record healed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An adopted file is refreshed by a later shipped change

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pre-manifest file that differs from resolved output is never adopted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A corrupt manifest refreshes nothing and does not fail the upgrade

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A configKey-overridden managed file stays fully suppressed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: managed-file-refresh.SM1.R3 — schema documentation states the actual behavior

skip: documentation-only invariant (comment corrections at schema.ts:86/1095, packs/types.ts:136) — verified at review, not runtime.

## Feature-level cross-scenario refactor

- [ ] cross-scenario
