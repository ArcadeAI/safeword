# Test Definitions: Auto-upgrade under Cursor

Feature source: retrofit from merged PRs #447 and #463; no separate `.feature` file exists for this cleanup.

test-definitions.md is the R/G/R ledger.

## Rule: Cursor sessionStart applies safe upgrades silently

### Scenario: auto-upgrade-cursor.TB1.AC1.silent_cursor_session_upgrade

- [x] RED: setup coverage expected only the SAFEWORD context hook, so the missing Cursor auto-upgrade hook was visible.
- [x] GREEN: Cursor setup installs `session-safeword-context.ts --agent=cursor` first and `session-cursor-auto-upgrade.ts` second.
- [x] REFACTOR: Cursor session-start hooks stay fail-open; the auto-upgrade wrapper exits `0` with no output when no upgrade applies.

## Rule: Cursor shares the cross-agent auto-upgrade implementation

### Scenario: auto-upgrade-cursor.TB1.AC2.shared_apply_core

- [x] RED: before PR #433, the apply path lived inside Claude's `session-auto-upgrade.ts`.
- [x] GREEN: Cursor's wrapper calls the shared `runAutoUpgrade()` core instead of copying upgrade logic.
- [x] REFACTOR: schema/package/hook coverage guards keep the Cursor wrapper registered without changing Claude or Codex behavior.

## Rule: Cursor gates wait during silent auto-upgrade

### Scenario: auto-upgrade-cursor.TB1.AC3.cursor_upgrade_lock

- [x] RED: post-merge review found Cursor `sessionStart` is fire-and-forget, so edits could race the silent upgrade.
- [x] GREEN: `auto-upgrade-lock.ts` guards the silent upgrade, and Cursor write/shell gates wait before acting on repository state.
- [x] REFACTOR: setup/reconcile preserves user-authored Cursor hook entries instead of replacing whole hook arrays.
