---
id: AVYV5A
slug: let-long-closeout-verification-finish
type: task
subtype: bug-investigated
phase: implement
status: in_progress
created: 2026-09-10T15:56:28.091Z
last_modified: 2026-09-10T15:58:50Z
---

# Let long closeout verification finish

**Goal:** Allow the guarded closeout preview to complete when valid repository verification commands run longer than fifteen minutes.

**Why:** The current fixed timeout kills legitimate full-suite and BDD verification, then can leave the wrapper hung without a cleanup plan.

**Type:** Bug

**Scope:** Run post-merge verification with a deadline large enough for the repository's supported
verification lanes and terminate the entire spawned command tree when that deadline is exceeded.

**Out of Scope:** Changing which verification lanes run, weakening closeout evidence, bypassing the
guard, or cleaning up pull request #4287 manually.

**Done When:**

- [x] Verification commands may run for up to one hour before closeout reports failure.
- [ ] A timed-out shell command and its descendants terminate without leaving closeout hung.
- [ ] The source template, installed dogfood copy, and plugin resource remain identical.

**Tests:**

- [x] Unit: the configured closeout verification deadline is one hour.
- [ ] Integration: a command that exceeds an injected short deadline returns a timed-out failure
      promptly and leaves no descendant process running.

## Root Cause

The closeout guard passes a fifteen-minute timeout to Bun's synchronous `spawnSync` shell runner.
Safeword's own verification and BDD commands can legitimately exceed that deadline. At the deadline,
the direct shell is killed, but Bun's synchronous wait can remain parked after the child tree has
gone, so the guard never emits either a cleanup plan or a failure plan.

Confirmed by two closeout previews for pull request #4287: each verification child ended at the
fifteen-minute boundary, while the parent remained idle with no children and no output. A process
sample showed the parent waiting in Bun's event loop.

Ruled out: duplicate test runners (only one runner existed at a time); repository mutation (the
delivery head and clean status remained unchanged); ongoing verification work (the hung parent had
no child process and zero CPU use).

## Work Log

- 2026-09-10T15:56:28.091Z Started: Created ticket AVYV5A
- 2026-09-10T15:58:50Z Found: The fixed fifteen-minute synchronous shell timeout is shorter than
  supported verification lanes and can strand Bun after timeout cleanup.
- 2026-09-10T16:05:27Z GREEN: Raised the project verification deadline to one hour; the focused
  closeout suite passes 115/115 tests with canonical parity restored.
