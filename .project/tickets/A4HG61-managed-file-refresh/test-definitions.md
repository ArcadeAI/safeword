# Test Definitions: Managed-file provenance refresh (#849)

Feature source: `features/managed-file-refresh.feature`

test-definitions.md is the R/G/R ledger.

## Rule: managed-file-refresh.TB1.R1 — an upgrade brings every pristine managed file to current resolved output

### Scenario: Setup records provenance for the managed files it writes

- [x] RED 6fcd25b
- [x] GREEN e071d9b
- [x] REFACTOR skip: util purpose-built this commit; no structural debt

### Scenario: Upgrade on a clone of an installed project preserves existing provenance

- [x] RED skip: CLI hard-refuses setup-on-installed (discovered at step wiring; scenario corrected to the upgrade path the clone flow actually uses)
- [x] GREEN 174e67a
- [ ] REFACTOR

### Scenario: A pristine static managed file is refreshed when its template changes

- [x] RED e271e89
- [x] GREEN 174e67a
- [ ] REFACTOR

### Scenario: A deleted managed file is recreated and regains provenance

- [x] RED skip: create-if-missing pre-exists; scenario guards the regained-provenance half via shared rule run
- [x] GREEN 174e67a
- [ ] REFACTOR

### Scenario: An unrecorded file that differs from resolved output is not brought current

- [x] RED skip: pre-feature invariant (upgrade never touched managed files); scenario guards it through the feature
- [x] GREEN 174e67a
- [ ] REFACTOR

## Rule: managed-file-refresh.TB1.R2 — every refresh is reported; no managed file changes silently

### Scenario: Upgrade output names each refreshed managed file

- [x] RED skip: reporting rode the decision rule's wouldUpdate (174e67a) into the pre-existing updated-list print
- [x] GREEN 42c32ef
- [ ] REFACTOR

### Scenario: Diff previews a pending refresh without writing it

- [x] RED skip: diff derives from the same dry-run plan; registry fetch is fail-soft (3s abort) so no neutralization needed beyond the recorded note
- [x] GREEN 42c32ef
- [ ] REFACTOR

## Rule: managed-file-refresh.TB1.R3 — a managed file already at current output is never rewritten

### Scenario: A pristine, current managed file is left unwritten on upgrade

- [x] RED skip: guard invariant — passed pre-feature; pins no-churn through the feature
- [x] GREEN 42c32ef
- [ ] REFACTOR

## Rule: managed-file-refresh.TB2.R1 — upgrade never rewrites a managed file whose bytes differ from safeword's recorded write

### Scenario: A customized managed file survives a shipped change untouched

- [x] RED skip: guard invariant — edits never touched pre-feature; pins it through the feature
- [x] GREEN 42c32ef
- [ ] REFACTOR

## Rule: managed-file-refresh.TB2.R2 — pristine status is re-derived from on-disk bytes at every upgrade

### Scenario: An edit made after an earlier refresh protects the file on the next upgrade

- [x] RED skip: guard invariant; kills any cached-pristine-flag implementation by construction
- [x] GREEN 42c32ef
- [ ] REFACTOR

## Rule: managed-file-refresh.TB2.R3 — no manifest state survives uninstall or reset

### Scenario Outline: Reset removes the provenance manifest in either mode

- [x] RED 77ffa5d
- [x] GREEN 42c32ef
- [ ] REFACTOR

## Rule: managed-file-refresh.SM1.R1 — provenance covers generator output as well as static templates

### Scenario: A pristine generated toolchain config is refreshed when its generator output changes

- [x] RED 77ffa5d
- [x] GREEN 42c32ef
- [ ] REFACTOR

### Scenario: A config whose generator now resolves nothing is left untouched

- [x] RED skip: guard invariant — generator-undefined skips by decision-rule case 2 (174e67a)
- [x] GREEN 42c32ef
- [ ] REFACTOR

## Rule: managed-file-refresh.SM1.R2 — byte-identity to current resolved output is the only adoption path into provenance

### Scenario: A pre-manifest file identical to resolved output gains provenance without a write

- [x] RED skip: adoption shipped inside the decision rule (174e67a); scenario proves it black-box
- [x] GREEN 42c32ef
- [ ] REFACTOR

### Scenario: A file matching resolved output but not its record has its record healed

- [x] RED skip: DD9 heal is the same byte-identity branch as adoption (174e67a)
- [x] GREEN 42c32ef
- [ ] REFACTOR

### Scenario: An adopted file is refreshed by a later shipped change

- [x] RED 77ffa5d
- [x] GREEN 42c32ef
- [ ] REFACTOR

### Scenario: A pre-manifest file that differs from resolved output is never adopted

- [x] RED skip: guard invariant — unprovable files skipped by decision-rule fall-through
- [x] GREEN 42c32ef
- [ ] REFACTOR

### Scenario: A corrupt manifest refreshes nothing and does not fail the upgrade

- [x] RED skip: fail-safe + warning shipped with the decision rule (174e67a); scenario pins DD8 both halves
- [x] GREEN 42c32ef
- [ ] REFACTOR

### Scenario: A configKey-overridden managed file stays fully suppressed

- [x] RED skip: K7N2QM suppression pre-existing; scenario reframed to the reachable override-after-install flow and pins non-recreation + inert entry
- [x] GREEN 42c32ef
- [ ] REFACTOR

## Rule: managed-file-refresh.SM1.R3 — schema documentation states the actual behavior

skip: documentation-only invariant (comment corrections at schema.ts:86/1095, packs/types.ts:136) — verified at review, not runtime.

## Feature-level cross-scenario refactor

- [ ] cross-scenario
