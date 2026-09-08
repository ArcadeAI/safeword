---
id: KDED4X
slug: codex-review-stamp-self-contained
type: task
phase: done
status: done
parent: 2C1E82
created: 2026-08-19T04:59:06.979Z
last_modified: 2026-08-30T08:00:00.000Z
---

# Let Codex's review-stamp and skill-invocation recording work without project files

**Goal:** Rewrite write-review-stamp.ts and record-skill-invocation.ts invocations in Codex skills to a pinned bunx call, updating codex-hook.ts's literal session-identity-bridge matcher in lockstep

**Why:** These are the two scripts codex-hook.ts's PreToolUse handler pattern-matches on by exact invocation text (RECORD_SKILL_INVOCATION_SCRIPT, WRITE_REVIEW_STAMP_SCRIPT) to bridge Codex's session id into a short-lived cache file; rewriting the invocation text without updating the matcher would silently break session-identity bridging for every Codex project

## Work Log

- 2026-08-19T04:59:06.979Z Started: Created ticket KDED4X
- 2026-08-30T08:00:00.000Z Completed by epic 2C1E82: review-stamp and skill-invocation recording use packaged commands while preserving runtime identity and lazy state hygiene.
