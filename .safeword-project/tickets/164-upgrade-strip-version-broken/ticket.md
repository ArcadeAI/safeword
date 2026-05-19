---
id: 164
type: task
phase: intake
status: in_progress
created: 2026-05-19T20:59:00Z
last_modified: 2026-05-19T20:59:00Z
scope: |
  Fix the broken implementation of main's ticket 154 (strip dead `version`
  field from .safeword/config.json). The test
  `tests/commands/upgrade.test.ts > Ticket 154 > should remove 'version' from
  existing config while preserving installedPacks` fails with:

  ```
  AssertionError: expected true to be false
  expect('version' in raw).toBe(false);  // raw still has 'version' key
  ```

  Test sequence:
  1. Creates a configured project with `safeword setup`
  2. Manually writes a config file with `{ installedPacks: ['typescript'], version: '0.25.14' }`
  3. Runs `safeword upgrade`
  4. Expects `version` key to be stripped from config — FAILS, key persists

  Main's PR #114 implementation likely either:
  (a) Doesn't run the strip migration on existing config
  (b) Runs the migration but doesn't write the result back
  (c) Has a path/encoding bug that prevents the JSON rewrite

  Code path to inspect: `packages/cli/src/commands/upgrade.ts` — the
  one-time strip migration that should drop `version` after reconcile.
out_of_scope: |
  - Changing the upgrade pipeline beyond fixing this specific migration
  - Removing other config fields
  - Backfilling version in older configs (the goal is removal, not preservation)
  - Modifying the SafewordConfig TypeScript interface beyond what main already did
done_when: |
  - `packages/cli/tests/commands/upgrade.test.ts > Ticket 154` test passes
  - Existing projects with `version` key in config.json get it stripped on next
    `safeword upgrade`
  - installedPacks and other fields are preserved
  - No other upgrade tests regress
  - Root cause documented in ticket (which of a/b/c was it)
---

# Fix broken strip-version migration in safeword upgrade

**Goal:** Main's ticket 154 implementation didn't actually strip the `version` field — the test added to verify it fails on `origin/main`. Make it work.

**Why:** This is a regression in main itself, not introduced by this branch. The test failure surfaced during ticket-152's full-suite verification before push. Fixing it here clears the CI noise that would otherwise persist on every PR against main.

## Work Log

- 2026-05-19T20:59:00Z Started: ticket created from test failures surfaced during ticket-152 session's post-rebase verification. Confirmed failure exists on plain origin/main, not introduced by 152 branch.
