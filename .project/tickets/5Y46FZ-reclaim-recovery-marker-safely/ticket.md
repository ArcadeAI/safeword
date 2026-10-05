---
id: 5Y46FZ
slug: reclaim-recovery-marker-safely
type: task
phase: done
external_prs: [https://github.com/ArcadeAI/safeword/pull/5380]
status: done
created: 2026-10-05T02:59:27.533Z
last_modified: 2026-10-05T14:52:00.000Z
---

# Stop concurrent package test runs when two runners recover the same abandoned lock

**Goal:** Reclaiming an abandoned test-lock recovery marker never deletes a live marker another runner just created

**Why:** A stale abandoned check could delete a live recovery marker, letting two build/vitest runs start at once (#419); found by Codex review during #5311

## Tests

- [x] `keeps a live recovery marker when a stale contender reclaims after it (#419)` — stale contender pauses after judging a dead marker abandoned; holder wins; a third contender inspects the live marker; fails on the original runner (holder marker deleted)
- [x] `keeps a live recovery marker when the marker is replaced during a stale reclaim (#419)` — marker released and recreated between the stale inspection and its publish
- [x] `keeps a replacement marker from a stale reclaim before its creator publishes (#419)` — stale publish lands in a fresh marker before owner-1 exists
- [x] Existing recovery/serialization cases in `tests/test-runner-lock.test.ts` stay green (54/54)

## Work Log

- 2026-10-05T02:59:27.533Z Started: Created ticket 5Y46FZ
- 2026-10-05T02:59:30Z Found: RED — preload-paused race reproduces live marker deletion against the original runner
- 2026-10-05T02:59:30Z Complete: GREEN — reclaim claims owner.json in place, verifies bytes, adopts via linkSync; 51/51 and 5/5 repeat runs (commit 9e3848465, PR 5380)
- 2026-10-05T04:30:00Z Found: Codex review rounds exposed three more variants of one class — moving a live owner aside (stranding / third-contender adoption), generation reuse across marker replacement, and pre-owner-1 publication
- 2026-10-05T04:30:00Z Decided: fix the class — owners are never removed; numbered owner-<n>.json published by exclusive hard link, owner-1 anchors a random instance id, highest owner of that instance is authoritative, every publish re-confirms authority
- 2026-10-05T04:30:00Z Complete: Codex cross-agent review approved; 54/54 lock tests; deterministic RED for each variant
- 2026-10-05T14:52:40.424Z Phase: verify → done
