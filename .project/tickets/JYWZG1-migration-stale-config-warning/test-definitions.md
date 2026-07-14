# Test Definitions — stale tooling-config warning

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

Scenarios for [JYWZG1](./ticket.md), follow-up to epic
[AQJ95G](../AQJ95G-project-namespace-default/spec.md). Lineage
`<jtbd-id>.AC<#>.<scenario_name>`; dimensions in [dimensions.md](./dimensions.md).

## Rule: The scanner finds stale references in tooling configs

> Rationale: TB1.AC1 — the detection core. Pure function over a cwd; the
> upgrade wiring consumes it.

### Scenario: migration-stale-config-warning.TB1.AC1.scanner_finds_stale_eslint_config

Given a repo whose `eslint.config.ts` lists `.safeword-project/` in its ignores
When the stale-config scanner runs
Then the result names `eslint.config.ts`

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: migration-stale-config-warning.TB1.AC1.scanner_finds_multiple_config_types

Given a repo whose `tsconfig.json` and `.github/workflows/ci.yml` both reference `.safeword-project/`
When the stale-config scanner runs
Then the result names both files

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: migration-stale-config-warning.TB1.AC1.upgrade_output_names_stale_file

Given a legacy install whose `eslint.config.ts` references `.safeword-project/`
When `safeword upgrade --migrate-namespace` moves the namespace
Then the upgrade output names `eslint.config.ts`

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: migration-stale-config-warning.TB1.AC1.upgrade_output_shows_old_new_mapping

Given a legacy install whose `eslint.config.ts` references `.safeword-project/`
When `safeword upgrade --migrate-namespace` moves the namespace and warns
Then the warning shows the `.safeword-project/` → `.project/` mapping

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: The warning never edits customer files

> Rationale: TB1.AC2 — the /figure-it-out line. List, don't touch.

### Scenario: migration-stale-config-warning.TB1.AC2.flagged_config_is_byte_identical

Given a legacy install whose `eslint.config.ts` references `.safeword-project/`
When `safeword upgrade --migrate-namespace` moves the namespace and warns
Then `eslint.config.ts` is byte-identical to its pre-upgrade content

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: No false positives

> Rationale: TB1.AC3 — the warning must be trustworthy. Documentary refs and
> safeword's own both-roots block are not customer breakage.

### Scenario: migration-stale-config-warning.TB1.AC3.clean_repo_produces_no_warning

Given a repo whose tooling configs do not reference `.safeword-project/`
When the stale-config scanner runs
Then the result is empty

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: migration-stale-config-warning.TB1.AC3.managed_prettierignore_block_not_flagged

Given a `.prettierignore` whose only `.safeword-project/` references are inside the `# Safeword - managed prettier exclusions` block
When the stale-config scanner runs
Then `.prettierignore` is not named

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: migration-stale-config-warning.TB1.AC3.customer_prettierignore_line_is_flagged

Given a `.prettierignore` with the managed both-roots block AND a separate customer line `.safeword-project/cache/` outside it
When the stale-config scanner runs
Then `.prettierignore` is named

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: migration-stale-config-warning.TB1.AC3.substring_near_miss_not_flagged

Given a config whose only reference is the unrelated path `.safeword-projectile/` (a substring near-miss, not the namespace)
When the stale-config scanner runs
Then the result is empty

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: migration-stale-config-warning.TB1.AC3.raw_legacy_line_without_managed_block_is_flagged

Given a `.prettierignore` with a raw `.safeword-project/` line and no `# Safeword - managed prettier exclusions` block at all
When the stale-config scanner runs
Then `.prettierignore` is named

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: migration-stale-config-warning.TB1.AC3.reference_under_safeword_owned_dir_not_flagged

Given a repo whose only `.safeword-project/` references live under the safeword-owned `.safeword/` directory
When the stale-config scanner runs
Then the result is empty

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: migration-stale-config-warning.TB1.AC3.documentary_reference_under_namespace_not_flagged

Given a repo whose only `.safeword-project/` references live in markdown under the resolved `.project/` namespace (e.g. a ticket body)
When the stale-config scanner runs
Then the result is empty

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: The warning fires only on an actual move

> Rationale: TB1.AC4 — gated on the move happening, not on the flag. A
> no-op migration must not warn about configs; a successful move must.
> (A move that throws aborts the upgrade before the warning step, so the
> silent cases below also cover the failure path.)

### Scenario: migration-stale-config-warning.TB1.AC4.warning_fires_when_move_succeeds

Given a legacy install with a stale `eslint.config.ts`, identical to the declined/both-dirs cases except that the move will succeed
When `safeword upgrade --migrate-namespace` moves the namespace
Then the stale-tooling-config warning IS printed, naming `eslint.config.ts`

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: migration-stale-config-warning.TB1.AC4.silent_when_no_move

Given a repo with a stale `eslint.config.ts` in the <install_state> state
When `safeword upgrade <flags>` runs and no namespace move occurs
Then no stale-tooling-config warning is printed

Examples:

| install_state                  | flags                  |
| ------------------------------ | ---------------------- |
| legacy, migration declined     | --no-migrate-namespace |
| both .project/ and legacy dirs | --migrate-namespace    |

> The other no-move classes (custom-root, already-current) return from
> `maybeMigrateNamespace` before the scan by construction — covered by 9MMWS7's
> plan-classification tests, not re-proven here.

- [x] RED
- [x] GREEN
- [x] REFACTOR
