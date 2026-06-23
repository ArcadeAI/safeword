# Spec: Eng review on green PRs with verifiable provenance

## Intent

A diff-focused engineering review that runs on a green PR before merge — the judgment a senior engineer adds on top of passing CI (correctness beyond the tests, test quality, scope/intent match, design fit, safety). Green CI proves mechanical correctness but says nothing about whether the tests are _good_, the change is the _right_ one, or it will age well. The win is **trust, not bug-catch rate**: provenance competitors can't copy (a _different_ model reviewed _this exact commit_; the receipt proves it; re-pushing voids it) plus ruthless signal discipline (only real blockers gate), so engineers actually read it instead of muting it.

## References

- `.project/tickets/Y9WX8R-eng-review-green-prs/ticket.md` — engineering contract (scope / out_of_scope / done_when) + phasing.
- Existing rails to reuse: `lib/review-ledger.ts` (content-hash-bound stamps, skip-with-reason), `session-author-model.ts` + `modelsMatch()` (cross-model enforcement).
- Evidence (via `/figure-it-out`): Google Tricorder / CACM "Lessons from Building Static Analysis Tools at Google" (~10% effective-FP abandonment threshold); Greptile 2025 benchmarks (recall-vs-noise tradeoff; quieter tools often preferred).
- Sibling skill kept separate: `quality-review` (ecosystem/version/CVE web research — NOT diff review).

## Personas

- **Technical Builder (TB)** — reads the diff; wants to catch the bugs and weak tests a green check hides, without noise.
- **Non-Technical Builder (NTB)** — can't audit the diff; an independent, commit-bound review is the only thing they can trust before merge.
- **Safeword Maintainer (SM)** — ships the capability safe-by-default and opt-in.

## Vocabulary

- **Green PR** — a PR whose CI (tests, lint, type-check, build) passes.
- **Receipt** — a review stamp in the ledger, scoped `<pr-number>@<head-sha>`, recording verdict + reviewer model; auto-stale on any new commit.
- **Effective false positive** — a finding the developer did not act on, true-but-trivial included (Tricorder's definition); the metric that predicts abandonment.
- **Verdict** — one of APPROVE / REQUEST-CHANGES / NEEDS-DISCUSSION.
- **Severity** — `blocker` (gates) | `should-fix` (advisory) | `nit` (advisory).

## Jobs To Be Done

### eng-review-green-prs.TB1 — Catch what green hides, without noise

**Persona:** Technical Builder (TB)

> When I open a green PR, I want an independent review that reads the change in context and tells me only what genuinely matters, so I catch the bugs and weak tests CI can't see without learning to ignore the bot.

#### eng-review-green-prs.TB1.AC1 — The review reads context, not just the diff

The verdict reflects the diff _plus_ the stated intent (PR body / linked ticket goal+AC), the surrounding files the diff touches, and the test files that ran.

#### eng-review-green-prs.TB1.AC2 — Every finding is concrete and evidence-bound

Each finding cites `file:line` and names a specific failure mode; a bare adjective ("looks fragile") is not a valid finding.

#### eng-review-green-prs.TB1.AC3 — The verdict is one of three fixed values

The result is exactly APPROVE, REQUEST-CHANGES, or NEEDS-DISCUSSION, each finding tagged `blocker` | `should-fix` | `nit`.

### eng-review-green-prs.TB2 — Blockers block; everything else whispers

**Persona:** Technical Builder (TB)

> When the review runs, I want only real blockers to stand between me and merge while smaller notes stay advisory, so the signal stays worth reading and review effort scales to the risk of the change.

#### eng-review-green-prs.TB2.AC1 — Only blockers gate

A verdict whose findings are all `should-fix`/`nit` does not block merge; a verdict with ≥1 `blocker` does.

#### eng-review-green-prs.TB2.AC2 — Depth scales to risk

A small diff gets a fast single pass; a large or flagged-path diff triggers a deep pass that pulls in the existing `audit`/`quality-review` machinery.

#### eng-review-green-prs.TB2.AC3 — Effective-FP is measurable

Each surfaced finding records whether the human acted on it, so the user-perceived false-positive rate is computable from the ledger.

### eng-review-green-prs.TB3 — A green merge reflects the code actually merging

**Persona:** Technical Builder (TB)

> When I approve a PR and then push one more fix, I want the prior approval to stop counting, so a green merge always reflects a review of the exact commit being merged, not a stale earlier version.

#### eng-review-green-prs.TB3.AC1 — Approval writes a commit-bound receipt

An APPROVE writes a receipt scoped `<pr-number>@<head-sha>` to the review ledger.

#### eng-review-green-prs.TB3.AC2 — A new commit voids the receipt

After a new commit, the prior receipt is stale and no longer satisfies the gate.

#### eng-review-green-prs.TB3.AC3 — Deliberate omissions are auditable

A `skip:reason` path exists for intentional omissions, reusing existing ledger semantics.

### eng-review-green-prs.NTB1 — Trust a merge I can't audit

**Persona:** Non-Technical Builder (NTB)

> When my agent says a PR is ready, I want to see in plain language that a _different_ model reviewed this exact change and whether anything should block merge, so I can trust the merge even though I can't read the code.

#### eng-review-green-prs.NTB1.AC1 — Plain-language verdict with a next action

The verdict and any blocker findings are stated without internal jargon and name the single next action when merge is not safe.

#### eng-review-green-prs.NTB1.AC2 — Independent reviewer is enforced and visible

When cross-model review is enabled, the recorded reviewer model differs from the author model and a same-model review is rejected.

### eng-review-green-prs.SM1 — Ship it dark and opt-in

**Persona:** Safeword Maintainer (SM)

> When I add this capability, I want merge enforcement gated behind a default-off flag and verified by a cheap no-LLM check, so teams adopt it on their own timeline and existing flows never break.

#### eng-review-green-prs.SM1.AC1 — Off by default, no behavior change

With `prReviewGate` OFF, there is no new blocking behavior anywhere.

#### eng-review-green-prs.SM1.AC2 — Enforcement requires a fresh receipt

With `prReviewGate` ON, a fresh head-bound receipt is required before merge.

#### eng-review-green-prs.SM1.AC3 — Verification is cheap and LLM-free

The receipt-verification check runs deterministically without invoking an LLM, suitable for a local hook or CI job.

#### eng-review-green-prs.SM1.AC4 — Shared core leaves Phase B open

The skill, verdict schema, and receipt are factored so a later CI-runs-the-review phase reuses them without rework.

## Outcomes

- A TB runs `/eng-review` on a PR and gets an actionable, low-noise verdict that catches at least the class of issues green CI misses (weak tests, uncovered edge cases, scope creep, pattern drift).
- An NTB can point to a plain-language, independently-produced, commit-bound verdict as their basis for trusting a merge.
- Re-pushing after approval reliably voids the green — no stale approvals slip through.
- With the flag off, zero existing users experience new blocking.
- The ledger yields an effective-FP rate; design north-star keeps it under ~10%.

## Open Questions

- defer: Exact "large or flagged-path" threshold that triggers the deep pass — operational tuning, resolve during implement.
- defer: Whether the cheap receipt check ships first as a local Stop-hook gate, a CI job, or both — Phase A can land in-session-only and add CI verification incrementally.
