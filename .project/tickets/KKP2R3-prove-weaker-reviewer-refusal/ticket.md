---
id: KKP2R3
slug: prove-weaker-reviewer-refusal
type: task
phase: intake
status: in_progress
created: 2026-10-11T04:39:33.699Z
last_modified: 2026-10-11T04:39:33.699Z
---

# Prove weaker reviewers cannot approve stronger authors’ plans

**Goal:** Qualify a genuine weaker reviewer pair and verify both coordinator refusal and prelaunch route selection against the real catalogue.

**Why:** Epic #4200 has no qualified weaker ordered pair. The user explicitly deferred these two real-catalogue proofs; controlled rejection tests do not replace them.

## Scope and acceptance

Follow-on to [epic #4200](https://github.com/ArcadeAI/safeword/issues/4200).
The user explicitly deferred these two verification cases on 2026-10-10 PDT.
The current catalogue has no qualified weaker ordered pair; no qualification
run or model change is authorized by this deferral.

Use a genuinely qualified weaker reviewer/stronger author pair from the real
catalogue to prove both coordinator refusal of independent approval and route
exclusion before producer launch. Retain the required rejection assertions in
the two `@deferred.KKP2R3` scenarios in
`features/keep-plan-reviews-current-and-trustworthy.feature`. Controlled
fixtures are useful unit coverage but do not substitute for these proofs.

Before qualification, establish a bounded cost and candidate plan. Do not
change production capability policy or manufacture a weaker relation to make
the tests pass. Resume these cases only with genuine qualification evidence;
retain failed and unfinished results. This deferral does not close the other
acceptance, review-ledger or readiness gaps in #4200.

## Work Log

- 2026-10-11T04:39:33.699Z Started: Created ticket KKP2R3
