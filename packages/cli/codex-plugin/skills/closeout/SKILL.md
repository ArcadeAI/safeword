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

## 3. Re-observe merge truth and resume

After every merge command—success or error—re-observe the exact pull request:

```sh
gh pr view PR_NUMBER --json state,mergedAt,mergeCommit,headRefName,headRefOid
```

Continue only when `state` is exactly `MERGED` and the observed head still
matches the recorded pull request head. Queued, automatic, pending, unknown, or
unobservable results are not merge proof; report the recovery check and stop.

If the command reported an error but fresh observation proves the expected head
was merged, report that the remote merge succeeded, do not retry it, and proceed
to the mandatory retrospective. On every invocation, re-observe durable state
and continue only the unfinished suffix. Treat an absent cleanup target as
complete only after proving it was the exact planned target. If the pull request
is merged, its retrospective is complete, and its exact branch and worktree are
already absent, report that the session is already closed.

## 4. Complete the current session's retrospective

After merge is independently confirmed, invoke the cleanup guard in preview
mode. Its host hook supplies a short-lived, single-consumer binding to this exact
session (and Cursor transcript). A missing or expired binding fails closed;
there is no newest-session fallback and callers cannot nominate another receipt,
session, transcript, or spool.

The guard runs `safeword retro run --format json` itself and accepts only a
successful result whose `data.agent_filing_needed` is `false` and whose derived
current session has an empty filing spool. Zero substantial findings and every
finding successfully filed are both complete outcomes.

Failed extraction, failed filing, pending drafts, malformed output, or an
identity mismatch means no cleanup. Report every failure and its recovery
action. A request to skip retro does not create a bypass: preserve the worktree
and branches and explain that the retrospective is required before cleanup.
