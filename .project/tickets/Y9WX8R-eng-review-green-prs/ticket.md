---
id: Y9WX8R
slug: eng-review-green-prs
type: feature
phase: define-behavior
status: in_progress
created: 2026-06-23T15:53:47.224Z
last_modified: 2026-06-23T15:53:47.224Z
scope:
  - New user-invocable `eng-review` skill that reviews a green PR (or working branch) the way a senior engineer would on top of passing CI — correctness beyond the tests, test quality, scope/intent match, design fit, safety.
  - Skill gathers the right context first - the diff, the stated intent (PR body + linked ticket goal/AC), the surrounding files the diff touches plus their tests - not the diff alone.
  - Skill emits a structured verdict (APPROVE / REQUEST-CHANGES / NEEDS-DISCUSSION) with findings as {severity, file:line, failure mode, suggested fix}. Findings must cite file:line and name a concrete failure mode - no bare adjectives.
  - On APPROVE, write a review receipt to the existing review ledger, scoped `<pr-number>@<head-sha>` (new scope key alongside the existing `<ticket>:<artifact>@<hash>` scope). Reuse `lib/review-ledger.ts`, content-hash binding, and skip-with-reason.
  - Record the reviewer model id and enforce reviewer != author when cross-model review is enabled (reuse `session-author-model.ts` + `modelsMatch()`).
  - Severity discipline - only `blocker`-severity findings gate the merge/receipt; `should-fix` and `nit` are advisory and never block.
  - Scale review depth to risk - fast single-pass on small diffs; deep pass (pull in `audit`/`quality-review` machinery) only on large diffs or flagged paths.
  - New config flag `prReviewGate` in `.safeword/config.json` (default OFF) - when on, a fresh, head-bound receipt is required before merge; verified locally/in-CI by a cheap stamp check (no LLM in CI for Phase A).
  - Effective-FP instrumentation - record whether each surfaced finding was acted on, so the user-perceived false-positive rate is measurable.
out_of_scope:
  - Phase B (CI runs the LLM review itself, posts findings as PR comments, sets a required GitHub status check). Separate follow-up ticket. Design must not preclude it - the skill, verdict schema, and receipt are the shared core both phases use.
  - Folding this into `quality-review` - that skill stays focused on ecosystem/version/CVE web research; `eng-review` is diff-focused. Two jobs, two skills.
  - GitHub merge automation / required-status-check wiring beyond local+CI receipt verification - follow-up.
  - Severity-escalation rollout policy (widening from blocker-only to should-fix) - operational tuning after launch.
  - General working-diff review outside a PR/branch context beyond what falls out for free.
done_when:
  - A user can run `/eng-review` in-session on a PR/branch and get a structured verdict with file:line findings and severities.
  - An APPROVE writes a receipt bound to the head commit; pushing a new commit invalidates it (the stale receipt no longer satisfies the gate).
  - When cross-model review is enabled, the recorded reviewer model differs from the author model (reuses existing enforcement), and a same-model review is rejected.
  - Only `blocker`-severity findings fail the gate; `should-fix`/`nit` are surfaced as advisory and never block.
  - With `prReviewGate` OFF, behavior is unchanged for existing users - no new blocking anywhere.
  - Each finding records whether the human acted on it, so effective-FP rate is computable from the ledger (design north-star: keep user-perceived FP < 10%).
  - Full test suite passes.
---

# Eng review on green PRs with verifiable provenance

**Goal:** Give safeword users a senior-engineer review of every green PR before merge whose trust is _verifiable_ — a (different) model reviews the exact commit, the approval receipt is bound to that commit and auto-invalidates on re-push, and only real blockers gate the merge.

**Why:** Green CI proves mechanical correctness (tests/lint/build pass) but says nothing about whether the tests are _good_, whether the change is the _right_ change, or whether it'll age well. That gap is what human eng review fills. The crowded AI-PR-bot market loses on one thing — noise — so the differentiator isn't bug-catch rate, it's _trust_: provenance (cross-model, commit-bound receipt) competitors can't replicate, plus ruthless signal discipline so engineers actually read it.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and acceptance criteria.

## Phasing

- **Phase A (this ticket):** in-session `/eng-review` + commit-bound receipt + cheap local/CI stamp-verification gate. Humans run the review; CI enforces a fresh receipt exists. Proves the signal discipline before automating.
- **Phase B (follow-up):** CI runs the `eng-review` skill headless on green PRs, posts findings as comments, sets a required status check. Same skill, same verdict schema, same receipt — bolted on as a fallback for PRs with no in-session receipt.

## Design laws (the "fire" criteria — see spec ACs)

1. **Blockers block; everything else whispers.** Only correctness/security blockers gate. Nits/style are advisory. (Keeps effective-FP under the ~10% abandonment line.)
2. **Earn severity escalation.** Ship blocker-only; widen later once trusted.
3. **Scale depth to risk.** Fast pass on small diffs; deep pass only on large/flagged changes.
4. **Provenance is the moat.** Cross-model reviewer (not grading its own homework) + receipt bound to the head commit (stale review auto-voids).

## Work Log

- 2026-06-23T15:53:47Z Started: Created ticket Y9WX8R.
- 2026-06-23T15:55:00Z Researched: AI-code-review adoption evidence (/figure-it-out). Key finding — tools die from noise, not weak detection. Google Tricorder "effective false-positive" < ~10% abandonment threshold; ~40% of AI alerts ignored under alert fatigue; quieter tools often preferred over higher-recall noisy ones. Conclusion: precision + provenance is the differentiator, not bug-catch rate.
- 2026-06-23T15:55:00Z Decided: scope as A-now-B-later, shipped as a safeword capability. Reuse existing review-ledger / cross-model / content-hash rails; the hard parts already exist.
- 2026-06-23T15:55:00Z Authored: ticket scope/out_of_scope/done_when + spec.md (JTBD/AC). Phase → define-behavior.
