---
id: 5Y46FZ
slug: reclaim-recovery-marker-safely
type: task
phase: verify
external_prs: [https://github.com/ArcadeAI/safeword/pull/5380]
status: in_progress
created: 2026-10-05T02:59:27.533Z
last_modified: 2026-10-05T02:59:27.533Z
---

# Stop concurrent package test runs when two runners recover the same abandoned lock

**Goal:** Reclaiming an abandoned test-lock recovery marker never deletes a live marker another runner just created

**Why:** A stale abandoned check could delete a live recovery marker, letting two build/vitest runs start at once (#419); found by Codex review during #5311

## Tests

- [x] `keeps a live recovery marker when a stale contender reclaims after it (#419)` in `packages/cli/tests/test-runner-lock.test.ts` — fails on the previous runner (holder marker deleted), passes with the fix
- [x] Existing recovery/serialization cases in `tests/test-runner-lock.test.ts` stay green (51/51)

## Work Log

- 2026-10-05T02:59:27.533Z Started: Created ticket 5Y46FZ
- 2026-10-05T02:59:30Z Found: RED — preload-paused race reproduces live marker deletion against the original runner
- 2026-10-05T02:59:30Z Complete: GREEN — reclaim claims owner.json in place, verifies bytes, adopts via linkSync; 51/51 and 5/5 repeat runs (commit 9e3848465, PR 5380)
