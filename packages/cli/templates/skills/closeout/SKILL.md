---
name: closeout
description: Close a completed local delivery safely. Use when wrapping up a
  finished coding session by verifying it, merging only with explicit authority,
  capturing retrospective learning, and cleaning the exact merged branch and
  worktree. Do NOT use for cloud-agent tasks, unmerged work, or cleanup without a
  pull request.
allowed-tools: Bash, Read, Glob, Grep
---

# Closeout

Close a completed local GitHub delivery from observed state. Never compress the
workflow into “merge succeeded, so we are done.”

## 1. Prove delivery readiness

Observe the pull request directly with structured `gh pr view --json` output.
A non-empty hosted check rollup whose checks are all terminal and green is
authoritative exact-head verification. When CI is absent, incomplete, failing,
or unobservable, run `/verify` for the current pull request head instead. Require
all of these before any merge:

- green hosted CI or local verification covers the current pull request head;
- all required checks pass;
- review requirements are satisfied; and
- the pull request is not a draft.

Collect and report every blocker. Missing, stale, failing, pending, unknown, or
ambiguous evidence means **no merge or cleanup**. A merge command's exit status
never proves that the pull request is merged.

Dependency audit is part of this delivery-time verification boundary. Resolve
its failures before merge while the pull request head can still be changed.

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
to retrospective capture. On every invocation, re-observe durable state
and continue only the unfinished suffix. Treat an absent cleanup target as
complete only after proving it was the exact planned target. If the pull request
is merged and its exact branch and worktree are already absent, report that the
session is already closed and report the retrospective's observed state.

The guard records a private, atomic verification receipt in Git's shared common
directory after green hosted CI covers a clean exact PR head, or after every
local verification lane passes on that head.
For 24 hours, that receipt can prove the immutable head when an interrupted
cleanup must resume from a surviving worktree after the topic worktree is gone.
After the topic worktree is gone, a missing, stale, malformed, dirty-state, or
wrong-head receipt blocks interrupted cleanup resumption.

## 4. Capture retrospective learning without making it cleanup authority

After merge is independently confirmed, invoke the cleanup guard in preview
mode. Its host hook supplies a short-lived, single-consumer binding to this exact
session (and Cursor transcript). Codex Desktop may instead supply its authenticated
current `CODEX_THREAD_ID`, consistent with SafeWord's other Codex identity bridges.
A missing or expired binding or identity is advisory for repository cleanup; there is
no newest-session fallback and callers cannot nominate another receipt, session,
transcript, or spool. Report the missing evidence without treating it as authority over
the worktree or branches.

The guard runs `safeword retro run --json --auto-extract` itself and accepts only a
successful result whose `data.agent_filing_needed` is `false` and whose derived
current session has an empty filing spool. Zero substantial findings and every
finding successfully filed are both complete outcomes.

Each successful run seals the last complete JSONL record from one immutable
transcript read. If preview reporting appends more complete records, apply
validates the sealed byte prefix and runs retro only over the bounded appended
window before advancing the receipt. A partial trailing record is neither
sealed nor lost; mutation or truncation of the sealed prefix fails closed.

Repository cleanup does not depend on a complete retrospective. A missing binding, an
incomplete retrospective, extraction failure, malformed output, or identity mismatch is
advisory: report it and continue evaluating cleanup from fresh repository evidence.

Filing failure or pending drafts are advisory for repository cleanup too. Report the
exact recovery action and the risk that deleting the worktree could discard captured
but unfiled learning, but do not let retrospective state authorize or block cleanup.

When the authenticated preview reports pending drafts and includes
`plan.retro.spoolPath`, invoke the `/retro-filer` skill with that exact
path, then rerun the preview. This is the closeout recovery continuation: the
guard derived the path from its short-lived host-session binding, so do not
substitute, discover, or accept a caller-provided spool path.

## 5. Preview, confirm, and apply exact cleanup

Run the guard from the delivery worktree; preview is the default:

```sh
bun .safeword/scripts/closeout-cleanup.ts --pr PR_NUMBER
```

At the exact clean delivery head, the post-merge preview reuses a fresh receipt
or mints one from terminal green hosted CI. Only when neither proof is available
does it run the project's verification, build, typecheck, and BDD plans. It does not rerun
dependency audit: that changing intelligence is enforced at the
delivery-time, pre-merge boundary and cannot repair an immutable merged head.
It reuses the exact verification snapshot and sealed retrospective evidence
through matching preview and apply invocations. Append-only transcript progress
advances through the bounded retrospective window without changing the cleanup
authorization digest. Changed repository state, cleanup targets, or any mutation
of the sealed transcript prefix still makes the plan stale.
After the topic worktree is gone, preview requires its fresh clean-head receipt.
It binds the resulting repository state and exact PR identity to `PLAN_DIGEST`.
Report the complete operation list and all blockers. Do not apply a blocked plan.

Invocation permits preview only and grants no destructive cleanup authority.
After reporting the exact operations and blockers, apply only when the current
user request explicitly authorizes cleanup. Cleanup authority is consumed when
apply is attempted, and applies only to the unchanged preview:

```sh
bun .safeword/scripts/closeout-cleanup.ts --pr PR_NUMBER --yes --plan PLAN_DIGEST
```

The guard re-observes identity and executes only this order: worktree, remote
branch, local branch. It never passes `--force` to `git worktree remove`; remote
deletion uses an exact `--force-with-lease`, and squash/rebase-safe local deletion
uses `git update-ref -d` with the recorded old OID. Never use merge-time branch
deletion. Changed, dirty, locked, stale, protected, default, main, ambiguous, or
other-worktree targets are preserved and reported with a recovery action.

## 6. Report the durable result

Claim the session complete only after fresh observation proves every state.
Report:

- verification and the exact verified head;
- merged state and merge commit;
- retrospective completion and filing result;
- remote branch, local branch, and worktree state; and
- unresolved items (explicitly `none` when empty).

When blocked or partially complete, report every blocker and its recovery action,
including simultaneous blockers. Never hide a successful remote merge behind a
later local cleanup failure, and never describe a planned deletion as completed.
