# Work Log — BBJKR5 keep-upgrade-success-on-health-warnings

- 2026-06-25T03:41:45.648Z Created task ticket for GitHub #427.
- 2026-06-25T03:44:00Z Revalidated GitHub #427. Local code path is `packages/cli/src/commands/upgrade.ts` post-apply `selfVerify`, which calls `reportHealthSummary` and exits 1 on any health issue.
- 2026-06-25T03:44:00Z Figure-it-out decision: keep `check` strict, but make `upgrade` post-apply diagnostics warning-only for exit-status purposes. Baseline diffing is larger and brittle for this bug.
- 2026-06-25T03:46:00Z Added task scope and moved to define-behavior before writing test definitions.
- 2026-06-25T03:48:00Z Added regression test definitions and moved the ticket to implement.
- 2026-06-25T03:50:00Z RED confirmed: `bun run test tests/commands/self-verify.test.ts` failed because `upgrade` returned exit code 1 where BBJKR5 expects 0.
- 2026-06-25T03:55:00Z GREEN: changed `upgrade` self-verify to report health diagnostics without converting them to exit 1. Verification passed for `tests/commands/self-verify.test.ts` and widened command/auto-upgrade set (4 files, 81 tests).
- 2026-06-25T03:55:00Z Additional verification passed: `bun run --cwd packages/cli typecheck` and `bun run lint:gherkin`.
- 2026-06-25T03:56:32Z Quality-review pass: no behavioral blockers. Updated stale self-verify test wording so it matches BBJKR5's new upgrade contract; reran `bun run test tests/commands/self-verify.test.ts` (18 passed).
