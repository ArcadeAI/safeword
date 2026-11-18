---
id: 2WEWKA
slug: release-test-timeout
type: patch
phase: done
status: done
created: 2026-11-17T17:27:16.885Z
last_modified: 2026-11-17T17:27:16.885Z
---

# Stop the plugin release test timing out on slow CI runners

**Goal:** The Claude plugin release-contract test passes on slow Node 22 CI runners instead of hitting its 30s limit.

**Why:** It spawns two generator --check subprocesses (~15s isolated) under a 30s limit; Node 22 CI timed it out on main (run 44045117013) and repeatedly on PR #7594.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-17T17:27:16.885Z Started: Created ticket 2WEWKA
- 2026-11-17T17:30:00.000Z Found: `check-claude-plugin-release.ts` spends its time in two generator `--check` subprocesses: historical catalogue 9.7s, plugin bundle 5.8s (local, idle). Node 22 CI pushed the total past 30s.
- 2026-11-17T17:32:00.000Z Fix: the test now uses `TIMEOUT_ACCEPTANCE_LANE` (120s), the helper for tests that spawn their own runners under full-suite load, with a comment naming the cost. 11/11 release tests pass locally; generated surfaces current. Speeding up the catalogue check itself is left out of scope.
- 2026-11-18T06:25:00.000Z Complete: CI fully green on 2fb721365 (test node 22 and 24 pass); user approved merge.
