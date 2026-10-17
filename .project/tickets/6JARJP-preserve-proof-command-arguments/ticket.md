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
