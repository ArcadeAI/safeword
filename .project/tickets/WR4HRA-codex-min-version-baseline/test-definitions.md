# Test Definitions: Codex Minimum Version Baseline

Feature source: `packages/cli/features/codex-min-version-baseline.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Setup reports unsupported Codex versions without blocking setup

### Scenario: codex-min-version-baseline.SM1.AC1.old_codex_cli_gets_setup_warning

- [x] RED: setup output stayed silent when `codex --version` reported `0.132.0`
- [x] GREEN: setup warns that `0.132.0` is below the `0.133.0` hook baseline without blocking setup
- [x] REFACTOR skip: shared Codex version utility owns parsing and warning copy

## Rule: Upgrade reports unsupported Codex versions without blocking upgrade

### Scenario: codex-min-version-baseline.SM1.AC2.old_codex_cli_gets_upgrade_warning

- [x] RED: upgrade output stayed silent when `codex --version` reported `0.132.0`
- [x] GREEN: upgrade warns that `0.132.0` is below the `0.133.0` hook baseline without blocking upgrade
- [x] REFACTOR: setup and upgrade both use the shared Codex version utility

## Feature-level cross-scenario refactor

- [x] cross-scenario: extracted `warnIfCodexBelowHookFloor` and the baseline constants into `packages/cli/src/utils/codex.ts`
