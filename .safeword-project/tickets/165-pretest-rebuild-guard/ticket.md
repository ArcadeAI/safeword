---
id: 165
type: patch
phase: intake
status: in_progress
created: 2026-05-19T21:04:00Z
last_modified: 2026-05-19T21:04:00Z
scope: |
  Add a `pretest` script (or fold `tsup` into `test`) in `packages/cli/package.json`
  so `bun run test` always rebuilds `dist/cli.js` before executing. Closes the
  silent-failure class where `runCli(...)`-based tests pass against a stale
  build that doesn't reflect the current source — surfaced twice in tickets
  163 and 164 from ticket-152's session.

  Choice of mechanism:
  (a) `"pretest": "tsup"` — bun/npm lifecycle hook; idiomatic
  (b) `"test": "tsup && vitest run"` — explicit one-line chain; obvious
  Both add ~2s to test invocation. (a) is conventional, (b) is more visible.

  Complements `setupOrThrow` (ticket-152's work) which catches stale-dist
  for integration tests using `beforeAll(...)` fixtures. This ticket
  catches it at the script level so direct `runCli(...)` calls inside
  `it(...)` blocks are also protected.
out_of_scope: |
  - Migrating away from tsup
  - Watching source files for changes (just unconditional rebuild before test)
  - Changes to the release-test script (already runs separately)
  - CI configuration (CI already runs build before test)
done_when: |
  - `bun run test` from a stale-dist state produces fresh dist before tests run
  - No test regressions (suite still passes)
  - Test runtime increase is bounded (~2-3s for the tsup step)
  - Documented behavior (one line in CLAUDE.md or AGENTS.md if appropriate)
---

# Add pretest rebuild guard against stale dist/cli.js

**Goal:** Always rebuild before tests so `runCli`-based tests can't silently pass/fail against a stale binary.

**Why:** Tickets 163 and 164 in this session were both "failures" that resolved by running `bun install` (which triggered `prepare` → rebuild). The underlying bug is that `dist/cli.js` can drift from source — after a rebase, after a checkout, after a manual source edit without a build — and `runCli` will execute the stale binary while the test reads current source assumptions. Result: misleading failures or silent passes. A pretest rebuild closes the gap with bounded cost (~2s).

## Work Log

- 2026-05-19T21:04:00Z Started: ticket created after closing 163 and 164 with the same root cause (stale dist).
