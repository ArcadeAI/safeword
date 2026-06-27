---
id: BBJKR5
slug: keep-upgrade-success-on-health-warnings
title: Keep successful upgrades from failing on health warnings
type: task
phase: verify
status: in_progress
priority: high
created: 2026-06-25T03:41:45.648Z
last_modified: 2026-06-25T03:56:32Z
external_issue: https://github.com/ArcadeAI/safeword/issues/427
scope:
  - Keep `safeword upgrade` exit status tied to whether the upgrade command itself applied successfully.
  - Continue printing post-upgrade health diagnostics so users can see existing configuration issues.
  - Preserve strict non-zero behavior for standalone `safeword check`.
out_of_scope:
  - Changing `safeword setup` self-verify failure behavior.
  - Classifying each health issue as pre-existing versus introduced by upgrade.
  - Suppressing or deleting health diagnostics.
done_when:
  - A successful upgrade exits zero even when post-upgrade health reports existing user-authored config issues.
  - The same health issue still makes `safeword check --offline` exit non-zero.
  - Upgrade output still names the issue and avoids a misleading healthy summary.
---

# Keep successful upgrades from failing on health warnings

**Goal:** Let automation trust `safeword upgrade` exit status as the apply result, while keeping post-upgrade health warnings visible.

**Why:** Codex auto-upgrade and other callers treat non-zero as a failed command. A successful apply followed by unrelated health diagnostics should not trigger rollback or strike accounting.

**Tests:**

- [x] Upgrade integration: malformed project-owned health content is reported but upgrade exits zero.
- [x] Check integration: the same malformed content still makes `safeword check --offline` exit non-zero.

## Work Log

- 2026-06-25T03:41:45.648Z Started: Created ticket BBJKR5
- 2026-06-25T03:44:00Z Revalidated GitHub #427 and traced the failure to `upgrade` self-verify calling `process.exit(1)` after a successful reconcile/apply.
- 2026-06-25T03:46:00Z Completed scope, out-of-scope, and done_when; moved to define-behavior for regression scenarios.
- 2026-06-25T03:48:00Z Added regression test definitions and moved to implement.
- 2026-06-25T03:55:00Z RED confirmed in `tests/commands/self-verify.test.ts` at upgrade exit-code expectation; implementation keeps post-upgrade diagnostics visible but removes the diagnostic-only exit 1. Verification passed: `bun run test tests/commands/self-verify.test.ts`, widened command/auto-upgrade set (4 files, 81 tests), `bun run --cwd packages/cli typecheck`, and `bun run lint:gherkin`.
- 2026-06-25T03:56:32Z Quality-review pass: no behavioral blockers. Updated stale self-verify test wording so it matches BBJKR5's new upgrade contract; reran `bun run test tests/commands/self-verify.test.ts` (18 passed).
