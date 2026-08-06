---
id: 6JWBNB
slug: realistic-review-deadlines
type: task
phase: implement
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1932
created: 2026-08-06T16:18:45.686Z
last_modified: 2026-08-06T16:47:45Z
---

# Let independent reviews finish for realistic packets

**Goal:** Let bounded independent reviews complete for realistic packets without requiring a caller-specific timeout override.

**Why:** A fixed two-minute default times out both Claude and Codex on real review packets, removing the independent evidence the workflow requires.

**Type:** Bug

**Scope:** Replace the fixed two-minute default with one finite ten-minute default for both headless reviewers. Keep `SAFEWORD_REVIEW_TIMEOUT_MS` as the explicit per-invocation override.

**Out of Scope:** The invalid Codex output-schema fallback (#1933), fair time allocation across multiple executable candidates (#1934), progress reporting, and changes to the reviewer packet or output contract.

**Done When:**

- [ ] Claude and Codex each receive a 600,000 ms default when no override is set.
- [ ] A positive `SAFEWORD_REVIEW_TIMEOUT_MS` value overrides that default for either reviewer.
- [ ] Each reviewer invocation remains bounded and reports `timed_out` when its deadline expires.

**Tests:**

- [x] Unit: the default timeout is 600,000 ms for Claude and Codex.
- [x] Unit: a valid explicit override wins for Claude and Codex.
- [x] Regression: the review runtime still derives a finite deadline before attempting reviewer candidates.

## Root Cause

`timeoutMilliseconds()` returned one fixed 120,000 ms value before selecting a reviewer. Real packets have already exceeded it for both Claude and Codex, even though the existing environment override can let the same review complete.

## Decision Record

Use a shared ten-minute default rather than a packet-size formula or a reviewer-specific exception. The observed recovery uses a 600,000 ms override; a finite cap preserves cancellation and avoids inventing an unmeasured sizing formula. This task deliberately does not alter candidate-fairness policy.

## Work Log

- 2026-08-06T16:47:45Z Verified: the RED case failed with the prior 300,000 ms/120,000 ms defaults; the focused runtime suite passed 15/15 after the shared 600,000 ms cap. Root ESLint, Prettier, and TypeScript checks passed; the generated Claude plugin release contract passed. The full workspace test-plan process exited after the relay suite passed 167 tests, but its final CLI result detached before it could be captured, so `verify.md` records that evidence limit before any done transition.
- 2026-08-06T16:47:45Z Quality review: approved the shared finite-cap design. Node's current child-process contract preserves explicit cancellation, and the deadline remains before candidate selection; no new entry point or dependency was introduced.
- 2026-08-06T16:19:00Z Decision: Revalidated #1932 on origin/main (`timeoutMilliseconds()` returns 120,000 ms); chose the existing 600,000 ms bounded override as the default for both reviewers after comparing fixed, packet-sized, and reviewer-specific policies.
- 2026-08-06T16:18:45.686Z Started: Created ticket 6JWBNB
