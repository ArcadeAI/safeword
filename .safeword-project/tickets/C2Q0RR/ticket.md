---
id: C2Q0RR
slug: configurable-test-timeout
type: task
phase: intake
status: in_progress
created: 2026-05-22T04:52:43.814Z
last_modified: 2026-05-22T04:52:43.814Z
scope:
  - Let projects override the hard-coded TEST_TIMEOUT_MS = 60_000 in packages/cli/templates/hooks/lib/test-runner.ts via an env var (SAFEWORD_TEST_TIMEOUT, value in seconds).
  - Default behavior unchanged (60s) when the env var is unset or invalid.
  - Update the timeout-failure message to mention the override mechanism so projects hitting the cap know how to lift it.
out_of_scope:
  - A config-file mechanism (e.g., safeword.config.json) — env var is simpler and matches the existing CLAUDE_PROJECT_DIR pattern.
  - Per-script timeout differentiation (test vs test:done) — one cap applies to whichever script runs.
  - Auto-detection of slow suites or per-project profiling.
done_when:
  - Setting SAFEWORD_TEST_TIMEOUT=120 lets a 90s test command pass the done-gate where it would have been killed at 60s before.
  - Invalid SAFEWORD_TEST_TIMEOUT values (non-numeric, negative, zero) fall back to the 60s default with no error.
  - Unset env var preserves current 60s behavior exactly.
  - The timeout-failure message tells the agent about SAFEWORD_TEST_TIMEOUT.
  - Existing test:done suite stays green.
  - New unit tests cover override-applied, invalid-value-fallback, and message-content paths.
---

# Configurable TEST_TIMEOUT_MS for done-gate runner

**Goal:** Let projects whose test command genuinely needs more than 60s opt into a higher cap on the done-gate's runTests call, without having to define a separate test:done subset.

**Why:** Surfaced during J7VBGJ when safeword's own ~10-min test suite blew past the 60s cap. The test:done escape valve (commit a753301) covers the 99% case — projects define a fast subset for the gate. But projects whose full test command takes 90s and want it as the gate's check (no subset needed) currently have no way to lift the cap. One env var fixes it.

## Context anchor

- Hard-coded cap: [packages/cli/templates/hooks/lib/test-runner.ts:22](packages/cli/templates/hooks/lib/test-runner.ts:22) — `const TEST_TIMEOUT_MS = 60_000;`
- Used by: `runTests` in same file, passes to execSync `timeout` option.
- Fix shape: replace `const` with a function call that reads `process.env.SAFEWORD_TEST_TIMEOUT`, parses, validates positive integer, multiplies by 1000, falls back to 60_000.

## Work Log

- 2026-05-22T04:52:43.814Z Started: Created ticket C2Q0RR. Source: J7VBGJ session sweep follow-ups. The test:done preference shipped in a753301 covers most cases; this ticket closes the remaining edge.
