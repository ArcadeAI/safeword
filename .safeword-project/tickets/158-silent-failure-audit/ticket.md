---
id: 158
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:26:00Z
last_modified: 2026-05-18T05:26:00Z
scope: |
  Grep-and-fix pass on the safeword codebase for "silent failure" patterns of the
  same shape as the runCli-setup discard that ticket 152 fixed. Categories to scan:
  (a) `await someAsyncCall(...)` in tests/helpers/hooks that discards the result
      when the result has an exitCode or success field
  (b) `try { ... } catch { /* swallow */ }` blocks without an explanatory comment
  (c) Hook handlers that log-and-continue when they should block (e.g., process.exit(0)
      after detecting a fatal precondition violation)
  (d) `|| true` shell idioms in scripts run as part of CI gates
  For each found, classify as (1) intentional (add a comment explaining why),
  (2) bug (fix or wrap in a throwing helper like setupOrThrow), (3) needs-discussion.
out_of_scope: |
  - Refactoring all error handling globally (only the silent-failure subset)
  - Adding a lint rule (separate ticket if value is proven)
  - Async-fire-and-forget patterns where discard is intentional and obvious
done_when: |
  - Audit report committed listing every found instance with classification
  - All (2) bugs fixed and tests passing
  - All (1) intentional sites have a comment explaining the swallow
  - All (3) needs-discussion items have follow-up tickets or resolution in this one
---

# Audit and fix silent-failure patterns across safeword

**Goal:** Find and fix the rest of the silent-failure class that hid the dist/cli.js missing case for so long.

**Why:** Ticket 152's `setupOrThrow` fixed one instance (runCli discard in beforeAll). The pattern almost certainly exists elsewhere — `try { } catch { }` blocks, `|| true` in scripts, hooks that exit 0 when they should block. Each instance masks a different real failure. One systematic pass costs less than the cumulative debugging time of letting them surface one at a time.

## Work Log

- 2026-05-18T05:26:00Z Started: ticket created from 152 audit follow-up
