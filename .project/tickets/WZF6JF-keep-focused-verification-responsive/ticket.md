---
id: WZF6JF
slug: keep-focused-verification-responsive
type: task
phase: verify
status: in_progress
created: 2026-08-12T14:09:53.488Z
last_modified: 2026-08-14T16:36:25Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1484
---

# Keep focused verification responsive for developers

**Goal:** Give a developer a prompt, actionable outcome when a focused Vitest run is blocked by another worktree, without ever running a second Vitest process.

**Why:** A global serialized test lane currently leaves small validation runs waiting behind unrelated full suites for many minutes.

## Work Log

- 2026-08-12T14:09:53.488Z Started: Created ticket WZF6JF
- 2026-08-12T14:12:54Z Decision: use bounded fail-fast with an actionable owner-aware error; FIFO is separately tracked by #2200 and preemption would risk another worktree's process and test evidence.
- 2026-08-12T14:16:48Z Implemented: reduced the default wait to 60 seconds and report the lock owner plus the documented longer-wait override; focused lock coverage passed after RED/GREEN cycles.
- 2026-08-12T14:57:25Z Verified: full suite (7,560 passing, 5 skipped), BDD lane (1,530 passing scenarios, 3 skipped), build, typecheck, dependency audit, and diff audit passed. The ticket remains in progress until its focused diff is separated from pre-existing worktree changes.
- 2026-08-13T15:15:41Z Revalidated #1484: the base runner still waits 20 minutes with a generic cap error, while 12 new reports reproduced the same cross-worktree contention. The bounded fail-fast decision remains relevant; live Vitest/Cucumber processes in other worktrees mean verification will resume after the shared lane is free.
- 2026-08-14T16:06:28Z Revalidated #1484 again: `origin/main` still uses the 20-minute generic cap, and no Vitest/Cucumber owner is live. Re-ran Figure-It-Out with current Node and Vitest documentation; bounded owner-aware fail-fast remains the smallest safe decision. Resuming verification.
- 2026-08-14T16:36:25Z Verification: focused lock coverage (14/14), lint, build, typecheck, and the lock-runner diff audit passed. The authoritative suites have unrelated current-worktree failures (three Vitest and one Cucumber); dependency audit reports the separately tracked NanoID advisory. Keep the ticket in verify until the scoped files are separated and a clean-worktree run is available.

## Scope

Improve the response when a focused package test run cannot acquire the shared Vitest capacity. The behavior must remain safe across worktrees.

**Out of Scope:** Running concurrent Vitest processes, changing test assertions or suite selection, and implementing the already-tracked FIFO fairness work in #2200.

**Done When:**

- [x] A blocked focused test reports a prompt, actionable outcome instead of silently waiting behind an unrelated full suite.
- [x] The runner never starts build or Vitest without holding the machine-wide lock.
- [x] The behavior is covered by real child-process integration tests.

**Tests:**

- [x] Integration: a live lock owner produces the actionable blocked outcome and starts no child command.
- [x] Integration: an available lock still builds and runs Vitest serially.
