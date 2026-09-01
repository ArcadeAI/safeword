---
name: pr-readiness
description: Prepare a pull request for human review and decide whether it may leave Draft. Use when creating or rewriting a PR description, marking a PR ready, responding to review, or checking whether a change is mergeable. Keeps incomplete evidence Draft. Do NOT use as a substitute for human approval or repository merge policy.
allowed-tools: '*'
---

# PR Readiness: Treat the Reviewer as the Customer

Make the pull request cheap to understand, verify, and approve. Ready means the
author believes the current head can merge immediately after approval—not that
the branch merely has a plausible diff or green unit tests.

## Observe the current pull request

Read the ticket, merge-base diff, commits, current PR body, check rollup, reviews,
and unresolved threads. Bind every conclusion to the current head SHA. Generated
summaries may supplement this evidence, but may not replace, obscure, or repeat
the reviewer context.

Keep speculative work on a branch. Open a Draft only to get concrete CI, AI
review, or a narrow human sanity check. Creating a PR, pushing, or publishing
does not authorize Ready promotion; the user must explicitly ask for Ready.

## Seven hard Ready-for-Review gates

Evaluate every gate. Missing, stale, unknown, pending, or contradicted evidence
is a **hard blocker**: report it and make or keep the pull request Draft.

1. **Ticket linkage:** the PR links the Linear ticket or the repository's
   authoritative tracker item.
2. **Author comprehension:** inspect the complete diff and understand every change;
   unexplained generated, copied, or agent-authored output blocks readiness.
3. **End-user execution:** exercise the current head through its end-user path.
   Tests alone are insufficient; record the concrete steps and observed result.
4. **Checks:** relevant local checks and CI are terminal and green for the current
   head. A skipped check is an evidence gap unless its reason and consequence are
   explicit.
5. **AI review:** complete the configured AI review and apply every finding or
   answer it with a reason. AI review is advisory evidence, never approval.
6. **Fresh self-review:** read the complete current diff top-to-bottom after the
   final material change. Confirm scope, behavior, clarity, and accidental files.
7. **Merge confidence:** the author can state that the current PR is immediately
   mergeable after approval, with no known follow-up required to make it safe.

Do not promote while any gate is incomplete. Name each blocker and the exact
recovery action. Never reinterpret “unit tests pass” as end-user verification or
pending CI as green.

## Write for the reviewer

Build the body from the actual ticket and diff. Keep only applicable sections;
write `None` for a meaningful empty state rather than silently omitting it.

- **Job to be done:** the user or operator outcome in plain English.
- **Summary and approach:** what changed and the shortest useful explanation of how.
- **Design decisions:** non-obvious choices and why they were made.
- **Scope and exclusions:** what belongs to this PR and what deliberately does not.
- **Stack context:** the direct dependency or prior PR, when this is one slice of a stack.
- **Verification:** completed commands and end-user steps with observed results.
- **Open questions and review focus:** unresolved decisions and where human judgment is wanted.
- **Risk and blast radius:** sensitive paths, failure consequences, and rollback notes.
- **Coverage status:** green or yellow; explain every yellow gap and its consequence.

Never turn unknown or unchecked evidence into completed verification. Never
describe cumulative stack changes as this slice's work: name its direct dependency,
its own diff, and its deliberate exclusions. Prefer a concise reviewer narrative
over an implementation manifest.

## Preserve the review conversation

- Reply before resolving every review thread, including when the code already changed.
- Leave disagreements unresolved so the reviewer—not the author—closes the decision.
- Re-request review after every material push; an approval of an older head is stale.
- Apply or answer every AI and human finding. Do not hide an unanswered finding by
  resolving, dismissing, or rewriting the summary.

## Report the decision

Report the current head and each gate as `pass` or `blocked`, with its concrete
evidence. Then provide the reviewer-oriented body or the minimal edits it needs.
End with exactly one outcome:

- `READY` only when all seven gates pass for the current head and the user has
  explicitly authorized Ready promotion.
- `DRAFT — <blockers>` otherwise.

Do not run `gh pr ready` on a `DRAFT` outcome.
