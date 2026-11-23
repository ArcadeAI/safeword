# Deterministic Readiness Evidence Status

**Status:** Accepted
**Date:** 2026-09-07
**Supersedes:** the no-approval/check/merge-capability clause of [Advisory PR Review as a Split-Privilege Evidence Pipeline](advisory-pr-review-as-a-split-privilege-evidence-pipeline.md)

**Context.** Of the seven PR readiness gates, four rely on author attestations that a machine cannot verify. Repository checks cover CI, and the existing receipt comment covers AI review. The remaining rule lacked an observer: evidence belongs to a particular head SHA and expires when the head moves. Publishing freshness requires a commit status. The earlier decision restricted model-derived receipts because they could affect merges.

**Decision.** Publish `safeword/pr-readiness` from a job in the existing router with no model, no secret, and `statuses: write` only. Customer workflows invoke the pinned npm CLI that installed them. Safeword's dogfood workflow checks out the trusted default branch and invokes its bundled runtime so the new command works on the first merge; because `pull_request_target` is privileged, that checkout must never select the pull request head. The command reads the pull request body and head SHA and emits one of five verdicts — `current`, `draft`, `stale`, `missing`, `blocked` — whose status descriptions come from a closed set of constants, so attacker-controlled body text never reaches the privileged request. It observes the evidence block and never judges the gates behind it. The job is serialized per pull request with `cancel-in-progress`; every run fetches the current body and head, so older events converge on the newest state. `edited` is in the trigger set because the status is about the body; the advisory reviewer excludes that action so a body edit never spends a model call. Safeword never modifies branch protection, and **recommends against requiring this context.**

GitHub stores the status on the commit. Two open pull requests can share that commit when the same branch targets two bases. Both write the same status context, so the later verdict stands. Per-pull-request serialization removes stale-event races but not that cross-pull-request ambiguity; a conservative verdict would cost an extra listing call and a second evaluation pass for a rare topology. This is a further reason not to require the context.

**Consequences.** Model-derived publications must never affect merge policy. The advisory reviewer publishes model findings only as an ordinary issue comment. Safeword advises against making the separate readiness status a merge requirement. A required context that stops being reported leaves every pull request stuck on "Expected — waiting for status to be reported", and this job only runs where `prReview.enabled` generates the router, so disabling the reviewer would jam merges repository-wide. An author can satisfy the check by writing a fresh, internally consistent block. The check cannot verify the underlying evidence. As an optional status it still alerts authors when a later push makes earlier evidence stale.

**Alternatives.** Relocate the job to its own workflow to satisfy the original clause: rejected because branch protection matches required checks by context-name string, not by workflow file, so relocation leaves the capability identical and would have been compliance in appearance only. Fold the verdict into the existing comment receipt: rejected because a comment cannot be required even by an owner who wants the signal to bind. A local PreToolUse hook blocking `gh pr ready`: rejected because it covers only the CLI path, misses the GitHub UI button entirely, and would block on text it cannot validate.

**Reassess when.** GitHub gives the draft-to-ready transition its own gateable rule; a mechanism appears that can verify an attestation rather than its freshness; or demand appears for the status in repositories that do not run the advisory reviewer.

**Implementation.** Ticket `522E5Z`; `packages/cli/src/pr-review/readiness.ts` (pure evaluator), `packages/cli/src/commands/review-pr-readiness.ts`, the `review-pr readiness` protocol entry, the `readiness` job in `templates/workflows/pr-review.yml`, and `packages/cli/tests/pr-review/readiness.test.ts` including a mutation-verified success-path publication test.

## Local delivery completion extension

[Local completion before marking a PR ready](local-delivery-completion.md) records the separate host-side guard.
