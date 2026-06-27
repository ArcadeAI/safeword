# Test Definitions: Auto-Upgrade under Codex

Feature source: `packages/cli/features/auto-upgrade-codex.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Codex SessionStart uses one dispatcher

### Scenario: auto-upgrade-codex.TB1.AC1.fresh_setup_wires_one_codex_sessionstart_dispatcher

- [x] RED: focused setup reconcile run still generated a direct `session-safeword-context.ts --agent=codex` SessionStart command and failed the dispatcher assertion.
- [x] GREEN: setup reconcile run generated exactly one SessionStart command pointing at `session-codex-start.ts`.
- [x] REFACTOR: schema drift guard explicitly treats `session-codex-start.ts` as Codex-only rather than wiring it into Claude `SETTINGS_HOOKS`.

### Scenario: auto-upgrade-codex.TB1.AC2.codex_dispatcher_emits_safeword_context_after_upgrade_check

- [x] RED: full-suite attempt surfaced the new dispatcher integration as failing before the installed hook/schema wiring was complete.
- [x] GREEN: targeted integration run passed with `SAFEWORD_NO_AUTO_UPGRADE=1`, proving the dispatcher emits Codex SessionStart `additionalContext`.
- [x] REFACTOR: `session-safeword-context.ts` now exports reusable context helpers while keeping standalone behavior intact.

## Rule: Auto-upgrade core maps outcomes per agent

### Scenario: auto-upgrade-codex.SM1.AC1.claude_wrapper_preserves_async_rewake_notices

- [x] RED: new core-mapper test failed because `hooks/lib/auto-upgrade.ts` did not exist.
- [x] GREEN: `toClaudeAutoUpgradeResponse()` maps normal notices to stderr plus exit code 2.
- [x] REFACTOR: Claude `session-auto-upgrade.ts` became a thin wrapper over the shared typed core.

### Scenario: auto-upgrade-codex.TB1.AC3.codex_dispatcher_never_uses_exit_two_for_notices

- [x] RED: new core-mapper test failed because the Codex response mapper did not exist.
- [x] GREEN: `toCodexSessionStartResponse()` maps notices to status 0 with `systemMessage` and preserves additional context.
- [x] REFACTOR: Codex dispatcher catches core exceptions so SAFEWORD.md context still loads on implementation errors.

## Rule: Failed apply rolls back safeword-managed changes

### Scenario: auto-upgrade-codex.SM1.AC2.failed_apply_rolls_back_safeword_managed_files

- [x] RED: new rollback test failed because the shared rollback helper did not exist.
- [x] GREEN: rollback helper resets/checks out tracked safeword-managed files and cleans untracked safeword-managed files only.
- [x] REFACTOR: `runAutoUpgrade()` invokes rollback before recording the failure strike.

## Feature-level cross-scenario refactor

- [x] cross-scenario: auto-upgrade policy and output mapping are centralized in `hooks/lib/auto-upgrade.ts`; wrappers now only adapt runtime input/output.
