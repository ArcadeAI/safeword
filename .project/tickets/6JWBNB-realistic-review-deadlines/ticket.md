---
id: 6JWBNB
slug: realistic-review-deadlines
type: task
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1932
created: 2026-08-06T16:18:45.686Z
last_modified: 2026-08-06T17:45:29Z
---

# Let independent reviews finish for realistic packets

**Goal:** Let bounded independent reviews complete for realistic packets without requiring a caller-specific timeout override.

**Why:** A fixed two-minute default times out both Claude and Codex on real review packets, removing the independent evidence the workflow requires.

**Type:** Bug

**Scope:** Replace the fixed two-minute default with one finite five-minute default for both headless reviewers. Keep `SAFEWORD_REVIEW_TIMEOUT_MS` as the explicit per-invocation override.

**Out of Scope:** The invalid Codex output-schema fallback (#1933), fair time allocation across multiple executable candidates (#1934), progress reporting, and changes to the reviewer packet or output contract.

**Done When:**

- [x] Claude and Codex each receive a 300,000 ms default when no override is set.
- [x] A positive `SAFEWORD_REVIEW_TIMEOUT_MS` value overrides that default for either reviewer.
- [x] Each reviewer invocation remains bounded and reports `timed_out` when its deadline expires.

**Tests:**

- [x] Unit: the default timeout is 300,000 ms for Claude and Codex.
- [x] Unit: a valid explicit override wins for Claude and Codex.
- [x] Regression: the review runtime still derives a finite deadline before attempting reviewer candidates.

## Root Cause

`timeoutMilliseconds()` returned one fixed 120,000 ms value before selecting a reviewer. Real packets have already exceeded it for both Claude and Codex, even though the existing environment override can let the same review complete.

## Decision Record

Use a shared five-minute default rather than a packet-size formula or a reviewer-specific exception. Both reviewers have crossed the old two-minute limit on realistic packets, while 91 observed successful reviews completed within 75 seconds. Five minutes leaves substantial load headroom without allowing each sequential route to consume the caller's full ten-minute ceiling. This task deliberately does not alter candidate-fairness policy.

## Work Log

- 2026-08-06T17:45:29Z Verified: current five-minute head passes 46/46 focused runtime and real CLI wiring tests. The persistent full test plan captured 167 passed/1 skipped relay tests and 440 files with 6,771 passed/5 skipped CLI tests before the branch advanced from the ten-minute predecessor. The direct BDD lane then failed 8 unrelated scenarios (seven `operate-retry-safe-retro-relay` Before-hook timeouts and one `predictable-safeword-cli` timestamp mismatch), so this ticket remains `verify`/`in_progress` without widening its scope.
- 2026-08-06T17:30:00Z Verified: 46/46 focused runtime and real CLI wiring tests pass, including the bounded `timed_out` path; ESLint, TypeScript, generated-plugin release alignment, and diff validation are clean.
- 2026-08-06T17:20:00Z Decision: Rebased onto current main and re-ran `/figure-it-out`; chose a shared 300,000 ms default because both reviewers have timed out at 120 seconds, 91 observed successes completed within 75 seconds, and the host CLIs expose no wall-clock review deadline of their own.
- 2026-08-06T16:47:45Z Verified: the RED case failed with the prior 300,000 ms/120,000 ms defaults; the focused runtime suite passed 15/15 after the shared 600,000 ms cap. Root ESLint, Prettier, and TypeScript checks passed; the generated Claude plugin release contract passed. The full workspace test-plan process exited after the relay suite passed 167 tests, but its final CLI result detached before it could be captured, so `verify.md` records that evidence limit before any done transition.
- 2026-08-06T16:47:45Z Quality review: approved the shared finite-cap design. Node's current child-process contract preserves explicit cancellation, and the deadline remains before candidate selection; no new entry point or dependency was introduced.
- 2026-08-06T16:19:00Z Decision: Revalidated #1932 on origin/main (`timeoutMilliseconds()` returns 120,000 ms); chose the existing 600,000 ms bounded override as the default for both reviewers after comparing fixed, packet-sized, and reviewer-specific policies.
- 2026-08-06T16:18:45.686Z Started: Created ticket 6JWBNB
