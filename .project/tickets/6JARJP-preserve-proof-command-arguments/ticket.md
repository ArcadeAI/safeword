---
id: 6JARJP
slug: preserve-proof-command-arguments
type: task
phase: verify
status: in_progress
created: 2026-10-16T18:20:25.666Z
last_modified: 2026-10-16T18:20:25.666Z
---

# Preserve proof commands and explain invalid reviews for contributors

**Goal:** Accept repeated flags and empty operands, preserve JSON backslashes, and retain structural rejection reasons.

**Why:** Land only the remaining argument and diagnostic fixes from PRs 4789 and 4988 against current main.

## Work Log

- 2026-10-16T18:20:25.666Z Started: Created ticket 6JARJP
- 2026-10-17: Completed scoped RED/GREEN repairs, test improvements, independent review, and the cache refactor. User authorized green CI and admin merge of PR #5897. Final verification is running.
