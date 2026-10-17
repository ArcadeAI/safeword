---
id: 6JARJP
slug: preserve-proof-command-arguments
type: task
phase: done
status: done
created: 2026-10-16T18:20:25.666Z
last_modified: 2026-10-17T16:35:00.000Z
---

# Preserve proof commands and explain invalid reviews for contributors

**Goal:** Accept repeated flags and empty operands, preserve JSON and ordinary-cell non-pipe backslashes, and retain structural rejection reasons. Existing admitted definitions whose parsed backslashes change require fresh plan-execution review.

**Why:** Land only the remaining argument and diagnostic fixes from PRs 4789 and 4988 against current main.

## Work Log

- 2026-10-16T18:20:25.666Z Started: Created ticket 6JARJP
- 2026-10-17: Completed scoped RED/GREEN repairs, test improvements, independent review, and the cache refactor. User authorized green CI and admin merge of PR #5897. Final verification is running.
- 2026-10-17: Frozen source cb18cb71f passed all 28 live semantic cases plus identity. Current lint/types and Audit pass. Final evidence review approved; its clarity warnings are applied. Exact-head CI, normal closure and authorized admin merge remain.
- 2026-10-17: CI 39003088682 passed frozen source cb18cb71f (11224 CLI tests per Node version, 596 scenarios / 11118 steps). The normal local completion gate then refused closure twice at its fixed acceptance timeout. Evidence is in verify.md and closure-timeout.md; ticket remains unfinished and PR Draft while a separate prerequisite scope decision is pending.
- 2026-10-17: User authorized fixing the timeout and retrying admin merge. The first prerequisite deduplicated root BDD delegation, recognized synchronous timeouts and preserved failed-suite diagnostics. Its eight-minute budget was insufficient under host load. CI 39041604751 passed prerequisite HEAD 95eea075; that is historical evidence.
- 2026-10-17: Corrected the mistaken immutable-600-second assumption against official host documentation. Reverted the failed parallel experiment completely. Final serial policy: 20 minutes for BDD, 40 minutes for native completion callbacks, 60 seconds for fast test commands. Every scenario, assertion and rejection rule is retained.
- 2026-10-17T16:32:07.139Z: The actual source Codex Stop adapter, with the real session identity, passed in 906.745 seconds, exit 0 and `{}` output, then automatically changed status to done. This log edit records that observed transition; it does not create it. Final budget tests passed 198/198 across 8 files; types, generated surfaces, parity and Audit passed. Independent Claude Opus source review d2f3caf0 approved with all warnings answered. Fresh final-commit CI and the authorized admin merge remain delivery actions.
- 2026-10-17T16:35:00.000Z: Clarified historical versus final verification, the resolved root-script assertion, the successful lock-queued proof retry and ordinary-cell backslash compatibility after independent evidence review. Frontmatter modification time records this clarification, separately from the automatic completion time above.

## Completion-timeout root cause

The root BDD script hides workspace delegation behind build commands joined by `&&`. The conservative resolver therefore retains both root and CLI BDD entries, executing the same 596 scenarios twice. A real passing CLI-only run took 303.131 seconds, exceeding the runner's 300-second per-BDD cap. Synchronous child-process timeouts expose `code: ETIMEDOUT` without `killed`, so the diagnostic falls through to generic termination output. Successful verbose suites can then truncate an earlier failure out of the completion report.

Confirmed by repeated real completion failures, a clean CLI-only profile, pinned Bun/Node subprocess probes, and a marker-based delegated-plan reproduction. Ruled out a hung scenario (the clean profile completed every scenario), runtime identity contamination (the clean profile removed hook identity), and sleep alone (the latest keep-awake closure still timed out). Full investigation and prior failed attempts remain in closure-timeout.md and verify.md.
