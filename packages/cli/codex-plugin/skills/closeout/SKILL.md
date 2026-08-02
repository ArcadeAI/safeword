---
name: closeout
description: Close a completed local delivery safely. Use when wrapping up a
  finished coding session by verifying it, merging only with explicit authority,
  running the mandatory retrospective, and cleaning the exact merged branch and
  worktree. Do NOT use for cloud-agent tasks, unmerged work, or cleanup without
  a pull request.
---

# Closeout

Close a completed local GitHub delivery from observed state. Never compress the
workflow into “merge succeeded, so we are done.”

## 1. Prove delivery readiness

Run `$safeword:verify` for the current pull request head. Then observe the pull request
directly with structured `gh pr view --json` output. Require all of these before
any merge:

- local verification covers the current pull request head;
- all required checks pass;
- review requirements are satisfied; and
- the pull request is not a draft.

Collect and report every blocker. Missing, stale, failing, pending, unknown, or
ambiguous evidence means **no merge or cleanup**. A merge command's exit status
never proves that the pull request is merged.

## 2. Respect merge authority

Invocation alone grants no merge authority. Read authority only from the current user request;
historical, implied, or previously consumed authority is not available to a
resumed closeout.

- **No authority:** report that the delivery is ready and stop before merging.
- **Normal merge:** only an explicit current request for a normal merge permits a
  policy-compliant `gh pr merge`. Never escalate a blocked normal merge.
- **Administrative merge:** only an explicit current request to perform an
  administrative merge or bypass repository requirements permits `--admin`.

Merge authority is consumed when the merge action is attempted. Entering a merge
queue or enabling auto-merge consumes it too; later runs observe that queued
action and do not repeat it.
