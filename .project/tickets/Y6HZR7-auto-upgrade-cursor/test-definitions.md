# Test Definitions: Auto-upgrade under Cursor

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

Feature source: `ticket.md`, `spec.md`, and `dimensions.md`.

test-definitions.md is the closeout scenario ledger. This ticket was implemented
before the scenario ledger was authored, so the R/G/R rows are intentionally
legacy bare checkboxes backed by PR #447, PR #463, and the closeout evidence in
`verify.md`.

## Rule: Cursor setup wires silent auto-upgrade

### Scenario: auto-upgrade-cursor.SM1.AC1.fresh_setup_wires_cursor_auto_upgrade

- [x] RED
- [x] GREEN
- [x] REFACTOR

Evidence: `setup-cursor.test.ts` asserts Cursor `sessionStart` keeps the
SAFEWORD.md context hook first and adds `session-cursor-auto-upgrade.ts` second.

### Scenario: auto-upgrade-cursor.TB1.AC1.cursor_session_start_stays_fail_open

- [x] RED
- [x] GREEN
- [x] REFACTOR

Evidence: hook integration coverage asserts the installed Cursor auto-upgrade
wrapper exits successfully with empty stdout and stderr when auto-upgrade is
disabled.

## Rule: Cursor reuses the shared auto-upgrade implementation

### Scenario: auto-upgrade-cursor.SM1.AC2.cursor_wrapper_reuses_shared_core

- [x] RED
- [x] GREEN
- [x] REFACTOR

Evidence: the Cursor wrapper calls `runAutoUpgrade()` from
`hooks/lib/auto-upgrade.ts`; schema, package, and hook-coverage tests include
the new wrapper and lock helper.

### Scenario: auto-upgrade-cursor.SM1.AC3.claude_behavior_stays_unchanged

- [x] RED
- [x] GREEN
- [x] REFACTOR

Evidence: focused closeout tests include the shared auto-upgrade core and
Claude/Codex setup regressions while Cursor keeps its own silent wrapper.

## Rule: Silent upgrade does not clobber user work

### Scenario: auto-upgrade-cursor.TB1.AC2.user_authored_cursor_hooks_are_preserved

- [x] RED
- [x] GREEN
- [x] REFACTOR

Evidence: setup/reset coverage preserves user-authored Cursor hook entries that
share an event with safeword hooks, including `sessionStart` and `preToolUse`.

### Scenario: auto-upgrade-cursor.TB1.AC3.cursor_writes_wait_during_silent_upgrade

- [x] RED
- [x] GREEN
- [x] REFACTOR

Evidence: the Cursor auto-upgrade lock integration test proves write and shell
gates deny operations while the silent upgrade lock is active.
