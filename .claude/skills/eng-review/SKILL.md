---
name: eng-review
description: Senior-engineer review of a green PR before merge. Use when a PR is
  green and headed for merge, or to re-review after new commits — judges
  correctness beyond the tests, test quality, scope/intent match, design fit, and
  safety. Emits a structured verdict plus a commit-bound receipt and blocks only
  on real blockers. Not for ecosystem/version checks (that is quality-review).
allowed-tools: '*'
---

# Eng Reviewing Green PRs

Senior-engineer review on top of green CI, before merge. Green proves mechanical
correctness (tests/lint/build pass); it says nothing about whether the tests are
_good_, the change is the _right_ one, or it will age well. This skill fills that
gap — and is ruthless about signal: a review nobody reads is worse than none.

## When to use

- A PR is green and headed for merge, in-session — run `/eng-review` before merging.
- Re-run after pushing new commits: a prior approval is bound to the old commit and
  no longer counts (provenance is head-bound).

The decision core lives in `.safeword/hooks/lib/pr-review.ts` (pure, tested). This
skill is the human procedure that produces a result that module validates.

## The one rule: blockers block, everything else whispers

Only **blocker**-severity findings should gate a merge. `should-fix` and `nit` are
advisory — surface them, never block on them. Field evidence is blunt: AI review
tools die from _noise_, not weak detection — past a ~10% effective-false-positive
rate (a true-but-trivial finding the developer ignores counts), developers mute the
tool and it stops helping. Precision is the job, not volume.

## Step 1 — Gather context (never review the diff alone)

A diff without its surroundings is a trap. Before judging, collect:

- **The diff** — `git diff main...HEAD` (or the PR's changed files).
- **The stated intent** — the PR description + the linked ticket's goal/acceptance
  criteria. This is the yardstick: _does the change do what it claims?_
- **The surrounding code** — open the full files the diff touches, plus their
  callers and their tests. Reason in context, not through a keyhole.
- **The tests that ran** — read the test _files_, not just the green check.

Scale depth to risk (`selectReviewDepth`): a small, low-risk diff gets a fast pass;
a large diff, or one touching a sensitive path (auth, secrets, migrations, money),
gets a thorough pass — pull in `/audit` / `/quality-review` for those.

## Step 2 — Run the checklist

For each changed area, work through these (they are what green CI can't see):

1. **Correctness beyond the tests** — trace the logic by hand. Edge cases, error
   paths, null/empty, off-by-ones, unbounded loops, races.
2. **Test quality** — are the tests exercising behavior, or vacuous (asserting
   mocks, tautologies, snapshot-everything)? A green check from a bad suite is a
   _false_ signal — this is the check that catches it.
3. **Scope & intent** — does the diff match the PR's stated goal? Flag scope creep
   and unrelated drive-by edits.
4. **Design fit** — right layer, consistent with existing patterns, no second way to
   do an existing thing, no leaky coupling. (See the project's architecture guide.)
5. **Safety** — input validation, authz, secrets, injection surfaces.

## Step 3 — Evidence, not adjectives

Every finding must cite **`file:line`** and name a **concrete failure mode**. "Looks
fragile" is rejected; "`retry()` at `rate_limiter.ts:42` has no max-attempts cap, so
a persistently-failing upstream spins forever" is a finding. Tag each with a
severity: `blocker` | `should-fix` | `nit`. A bare adjective is not a finding.

## Step 4 — Emit a structured verdict

Produce a result the decision core (`validateReviewResult`) accepts:

```json
{
  "verdict": "APPROVE | REQUEST-CHANGES | NEEDS-DISCUSSION",
  "findings": [
    {
      "location": "src/rate_limiter.ts:42",
      "failureMode": "retry loop has no max-attempts cap; a failing upstream spins forever",
      "severity": "blocker"
    }
  ],
  "nextAction": "cap the retry loop at N attempts and add a backoff"
}
```

- `verdict` must be exactly one of the three values.
- Every finding needs `location` (`path:line`), a non-empty `failureMode`, and a
  known `severity`.
- A non-APPROVE verdict **must** state a `nextAction` (so a non-technical owner
  knows what happens next, in plain language).

### Provenance — the receipt

On APPROVE, the review is recorded against `<pr-number>@<head-sha>` so a green merge
reflects a review of _this_ commit. Push a new commit and the approval goes stale —
re-review. When cross-model review is enabled, the reviewer model must differ from
the author model (the review can't grade its own homework).

### Break-glass skip

If a PR genuinely should not be reviewed (e.g. a vendored bundle), record a
`skip:<reason>` — it permits merge but is logged as a _distinct, attributed bypass_,
never as an approval. An empty reason is rejected: a deliberate bypass must be
attributable.

## Honest limits

This judges what is in the diff and the repo. It will not catch "this whole feature
is the wrong idea" or context that lives only in someone's head — that is still a
human's call. What it reliably catches is what a rushed reviewer skips on a green
PR: weak tests, uncovered edge cases, scope creep, pattern drift.

**Next:** on APPROVE, record the receipt and proceed to merge. On REQUEST-CHANGES,
name the blocker fix and re-review after the push. On NEEDS-DISCUSSION, name the
question for the author.
