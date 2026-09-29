---
id: VCE5QF
slug: preserve-retrospective-drafts-during-closeout
type: task
phase: intake
status: in_progress
created: 2026-09-28T23:44:56.482Z
last_modified: 2026-09-28T23:44:56.482Z
---

# Preserve retrospective drafts during closeout for developers

**Goal:** Prove pending retrospective drafts survive topic worktree removal and block cleanup if preservation fails.

**Why:** Independent review found the preservation path lacks end-to-end proof and may report success without a durable draft.

## Work Log

- 2026-09-28T23:44:56.482Z Started: Created ticket VCE5QF
- 2026-09-28T23:44:56.482Z Found: Independent closeout review requested end-to-end proof that a pending draft survives worktree removal. Current `draftSpoolPath` uses `.safeword/retro-drafts`, matching the cleanup guard's directory, so the proposed path-divergence premise is unproven. Investigate the remaining fail-open and copy-verification concerns separately from issue #3033.
