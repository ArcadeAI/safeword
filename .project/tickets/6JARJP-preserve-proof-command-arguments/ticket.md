---
id: 6JARJP
slug: preserve-proof-command-arguments
type: task
phase: done
status: in_progress
created: 2026-10-16T18:20:25.666Z
last_modified: 2026-10-17T05:10:00.000Z
---

# Preserve proof commands and explain invalid reviews for contributors

**Goal:** Accept repeated flags and empty operands, preserve JSON backslashes, and retain structural rejection reasons.

**Why:** Land only the remaining argument and diagnostic fixes from PRs 4789 and 4988 against current main.

## Work Log

- 2026-10-16T18:20:25.666Z Started: Created ticket 6JARJP
- 2026-10-17: Completed scoped RED/GREEN repairs, test improvements, independent review, and the cache refactor. User authorized green CI and admin merge of PR #5897. Final verification is running.
- 2026-10-17: Frozen source cb18cb71f passed all 28 live semantic cases plus identity. Current lint/types and Audit pass. Final evidence review approved; its clarity warnings are applied. Exact-head CI, normal closure and authorized admin merge remain.
- 2026-10-17: CI 39003088682 passed frozen source cb18cb71f (11224 CLI tests per Node version, 596 scenarios / 11118 steps). The normal local completion gate then refused closure twice at its fixed acceptance timeout. Evidence is in verify.md and closure-timeout.md; ticket remains unfinished and PR Draft while a separate prerequisite scope decision is pending.
- 2026-10-17: User authorized fixing the timeout and retrying admin merge. Completion prerequisite: explicit root BDD delegation, a bounded eight-minute acceptance budget, accurate synchronous timeout recognition, and preserved failing-suite diagnostics. Keep every test and conservative conditional-delegation coverage.

## Root Cause

The root BDD script hides workspace delegation behind build commands joined by `&&`. The conservative resolver therefore retains both root and CLI BDD entries, executing the same 596 scenarios twice. A real passing CLI-only run took 303.131 seconds, exceeding the runner's 300-second per-BDD cap. Synchronous child-process timeouts expose `code: ETIMEDOUT` without `killed`, so the diagnostic falls through to generic termination output. Successful verbose suites can then truncate an earlier failure out of the completion report.

Confirmed by repeated real completion failures, a clean CLI-only profile, pinned Bun/Node subprocess probes, and a marker-based delegated-plan reproduction. Ruled out a hung scenario (the clean profile completed every scenario), runtime identity contamination (the clean profile removed hook identity), and sleep alone (the latest keep-awake closure still timed out). Full investigation and prior failed attempts remain in closure-timeout.md and verify.md.
