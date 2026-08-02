---
name: closeout
description: Close a completed local delivery safely. Use when wrapping up a
  finished coding session by verifying it, merging only with explicit authority,
  running the mandatory retrospective, and cleaning the exact merged branch and
  worktree. Do NOT use for cloud-agent tasks, unmerged work, or cleanup without a
  pull request.
allowed-tools: '*'
---

# Closeout

Close a completed local GitHub delivery from observed state. Never compress the
workflow into “merge succeeded, so we are done.”

## 1. Prove delivery readiness

Run `/verify` for the current pull request head. Then observe the pull request
directly with structured `gh pr view --json` output. Require all of these before
any merge:

- local verification covers the current pull request head;
- all required checks pass;
- review requirements are satisfied; and
- the pull request is not a draft.

Collect and report every blocker. Missing, stale, failing, pending, unknown, or
ambiguous evidence means **no merge or cleanup**. A merge command's exit status
never proves that the pull request is merged.
