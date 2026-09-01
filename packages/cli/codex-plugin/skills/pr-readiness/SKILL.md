---
name: pr-readiness
description: Prepare a pull request for human review and decide whether it may
  leave Draft. Use when creating or rewriting a PR description, marking a PR
  ready, responding to review, or checking whether a change is mergeable. Keeps
  incomplete evidence Draft. Do NOT use as a substitute for human approval or
  repository merge policy.
---

# PR Readiness: Treat the Reviewer as the Customer

Make the pull request cheap to understand, verify, and approve. Ready means the
author believes the current head can merge immediately after approval—not that
the branch merely has a plausible diff or green unit tests.

## Observe and preserve

Read the ticket, merge-base diff, commits, current PR body, check rollup, reviews,
and unresolved threads at the current head SHA. Generated summaries may
supplement this evidence, never replace or obscure it.

Keep speculative work on a branch. Open a requested PR as Draft only for concrete
CI, AI review, or a narrow human check. Reply before resolving every thread;
leave disagreements for the reviewer to resolve; re-request review after a
material push. Apply or answer every finding.

Changing Draft/Ready state requires explicit authority in the current user
request for that exact change. Otherwise observe and report state only.

## Seven hard Ready-for-Review gates

Evaluate every gate. Missing, stale, unknown, pending, skipped without an
explained consequence, or contradicted evidence is a **hard blocker**: recommend
Draft and give the recovery action.

1. **Ticket linkage:** the PR links the Linear ticket or the repository's
   authoritative tracker item.
2. **Author comprehension:** inspect the complete diff and understand every change;
   unexplained generated, copied, or agent-authored output blocks readiness.
3. **End-user execution:** exercise the current head through its end-user path.
   Record steps and results; tests alone are insufficient. If no runnable surface
   exists, record `not applicable`, why, and the nearest real delivery boundary.
   Never invent a walkthrough.
4. **Checks:** relevant local checks and CI are terminal and green for the current
   head.
5. **AI review:** complete the configured AI review and apply every finding or
   answer it with a reason. Configured policy decides acceptable independence;
   `require unsatisfied` blocks. AI review is evidence, never approval.
6. **Fresh self-review:** read the complete current diff top-to-bottom after the
   final material change. Confirm scope, behavior, clarity, and accidental files.
7. **Merge confidence:** the author can state that the current PR is immediately
   mergeable after approval, with no known follow-up required to make it safe.

When `$safeword:quality-review` or `$safeword:finish-review` returns, resume this same readiness run
and evaluate gate 5. Disclose degraded or absent independence. Do not restart the
review loop unless a later material change makes its evidence stale.

## Write for the reviewer

Build the body from the ticket and diff. Keep only applicable sections and write
`None` for a meaningful empty state.

- **Why:** job to be done in plain English.
- **What changed:** concise approach, non-obvious decisions, scope, exclusions,
  and direct dependency when stacked.
- **Verification:** commands, end-user steps, results, and yellow coverage gaps.
- **Risks and review focus:** blast radius, rollback, open questions, and where
  human judgment is wanted.
- **Readiness evidence:** use this exact durable handoff shape:

  ```text
  Head: <full current head SHA>
  1. Ticket linkage — PASS: <evidence>
  2. Author comprehension — PASS: <evidence>
  3. End-user execution — PASS: <evidence>
  4. Checks — PASS: <evidence>
  5. AI review — PASS: <evidence>
  6. Fresh self-review — PASS: <evidence>
  7. Merge confidence — PASS: <evidence>
  ```

  Never carry this evidence forward after the head changes.

Never manufacture verification or describe cumulative stack changes as this
slice's work. Prefer a concise reviewer narrative over an implementation manifest.

## Report the decision

Report the current head and each gate as `pass` or `blocked`, with its concrete
evidence. Then provide the reviewer-oriented body or the minimal edits it needs.
End with exactly one outcome:

- `READY` when all gates pass and the PR is already Ready, or the user explicitly
  authorized Ready promotion.
- `GATES PASS — awaiting explicit Ready authorization` when all seven gates pass,
  the pull request is Draft, and the current request did not authorize promotion.
- `DRAFT — <blockers>` when one or more gates are blocked.

Do not run `gh pr ready` or `gh pr ready --undo` unless the current user request
explicitly authorizes that exact state change.
