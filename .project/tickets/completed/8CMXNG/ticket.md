---
id: 8CMXNG
slug: bound-recent-failures
type: patch
phase: done
status: done
created: 2026-05-20T17:42:18.173Z
last_modified: 2026-05-20T17:42:18.173Z
---

# Per-pattern dedup for recentFailures

**Goal:** Bound `state.recentFailures` by distinct pattern count via per-pattern dedup with timestamp refresh, so the array can't grow unboundedly on repeated firings of the same pattern.

**Why:** Audit during ticket 4N5Y28 found this as the one remaining unbounded mutable in `QualityState`. Low severity (session-scoped, sub-KB per entry) but a real shape mismatch — both consumers (`prompt-questions.ts:getFailureInjection`, `stop-quality.ts:471`) only ever ask "does pattern P exist?" or "what was the most recent pattern?", never iterate the full array. Per-pattern dedup matches that semantic exactly; the bound is implicit (≈ number of distinct patterns, currently 2-3).

**Scope:** Single change in `recordFailure` (template + consumer pair) — on push, remove any prior entry for the same pattern, then push fresh; preserves `failures[last]` = most-recent semantics because the array stays ordered by last-occurrence. One new integration test in `failure-memory.test.ts` asserting (a) repeated firings yield length 1, (b) the surviving entry's timestamp is the most recent firing.

**Out of scope:** Changing `recordFailure`'s signature, consumer code, the persistent counter logic (`incrementedPatterns` and the counter file are already per-pattern-dedup'd).

## Work Log

- 2026-05-20T17:42:18.173Z Started: Created ticket 8CMXNG
