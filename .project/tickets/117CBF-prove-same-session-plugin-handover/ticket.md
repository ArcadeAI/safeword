---
id: 117CBF
slug: prove-same-session-plugin-handover
type: task
phase: implement
status: in_progress
created: 2026-10-21T16:16:30.339Z
last_modified: 2026-10-21T16:16:30.339Z
---

# Prove uninterrupted plugin protection after cleanup

**Goal:** Repair M2 by exercising actual legacy authority, exact proof, cleanup, and same-session plugin takeover

**Why:** The existing post-cleanup scenario starts fresh and cannot detect a broken handover

## Work Log

- RED: the original fixture fails with `the handover must execute real cleanup`.
- GREEN: exact SessionStart proof, legacy approval, confirmed cleanup, and same-session plugin takeover pass.
- Five broken fixture variants fail: skipped cleanup, missing plugin effect, duplicate plugin effect, changed hook session input, and missing legacy execution. The session probe validates harness continuity, not runtime session-dependent policy.
- Native acceptance passes 63 scenarios and 3,013 steps; root lint and CLI typecheck pass. Independent Claude Opus review approves the final source without blocking findings.
- Repository-wide acceptance passes 597 scenarios and 11,140 steps. The follow-on proof-tag test process never started because another checkout retained the shared test lock; the wrapper exited 75 after 60 seconds.
- The implement-exit stamp was refused because branch-wide coverage includes earlier ticket work. This scoped repair is verified, but the ticket phase was not advanced or marked done.

## Scope

Repair assessment M2 only. Exercise the registered legacy config guard and the
real plugin dispatcher, obtain exact SessionStart proof, perform real CLI
cleanup, and observe plugin authority on the next PreToolUse in the same
session, cache, and plugin-data directory. Keep the fake Claude profile adapter;
this proves the dispatcher/cleanup boundary rather than desktop host lifecycle.

Out of scope: production behavior, M3, other assessment findings, release actions.

## Tests

- RED: require actual cleanup, matching proof, and an unchanged session; the old fresh fixture fails.
- GREEN: legacy protection executes before cleanup, cleanup removes its registration and writes a clean marker, and the next event produces exactly one plugin effect. Shared hook source remains under the current cleanup contract.
- Fault probes: skipped cleanup, stale legacy suppression after cleanup, changed session, and duplicate plugin execution must fail.
- Run the full native feature, applicable static checks, and independent review.

- 2026-10-21T16:16:30.339Z Started: Created ticket 117CBF
