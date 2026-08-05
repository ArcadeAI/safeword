---
id: P0D6S2
slug: trustworthy-advisory-pr-review
type: epic
phase: plan-implementation
status: in_progress
children: [HXT3GW, Z7M7Y3, 436EQW]
scope:
  - Automatically review each ready, substantive pull request at its current head SHA after the repository's deterministic prerequisites settle.
  - Apply a technology-neutral integrity floor to every behavior-affecting artifact, including unfamiliar file types, and record any deliberate exclusion.
  - Derive one evidence-bounded advisory route from deterministic checks, model findings, unresolved questions, run completeness, and freshness.
  - Publish actionable inline findings plus one plain-English receipt that states the reviewed revision, what ran, what did not, remaining unknowns, and token/noise usage or why none was incurred.
  - Publish the receipt through a surface that cannot approve the pull request or satisfy a required merge check.
  - Invalidate and supersede an older conclusion after a material update without repeating unchanged findings.
  - Inspect untrusted fork changes as data without write-capable authority, then pass only serialized advisory evidence into the isolated write-capable publication stage.
  - Execute same-repository code only for a named evidence-producing check in an eligible sandbox, with the exact command, revision, and outcome recorded.
out_of_scope:
  - Merging, approving, or modifying customer pull requests.
  - Automatically applying model-proposed remedies or treating model text as execution evidence.
  - Retrospective efficacy calibration, cross-vendor selection policy, full BDD/TDD quality scoring, owner routing, and cross-repository impact; these remain in issues #1910-#1915.
  - Merging the experimental spike branch or treating draft PR #1917 as acceptance proof.
done_when:
  - A ready substantive pull request is automatically reviewed at the exact current head SHA.
  - The unfamiliar `.flux` policy regression from the preserved live spike produces an access-control finding and `needs a human`.
  - Deterministic CI proves that unfamiliar artifacts reach the integrity reviewer and that a returned access-control finding routes to a human; the live `.flux` model run remains an explicitly selected evaluation.
  - A no-finding review reports what ran, what did not, remaining unknowns, revision, and usage without implying approval.
  - A material push invalidates the old conclusion and leaves one current receipt without duplicate unchanged findings.
  - Incomplete, stale, or failed review runs cannot emit `looks ready`.
  - No publication claims tests or remedy verification from model text alone.
  - Untrusted fork code is never executed by a job that can write, approve, or merge.
  - Publishing an advisory receipt does not change whether GitHub considers the pull request mergeable.
  - An update with uncertain materiality invalidates the prior conclusion and requires review before a new route is published.
  - Execution eligibility alone never authorizes customer-code execution; every executed path produces named evidence in the receipt.
  - Noise and available token use are recorded for every terminal review attempt; unavailable failure metrics are explicit unknowns.
  - No-review receipts record their current revision, classification evidence, skipped checks, remaining unknowns, and that model usage and finding noise were not incurred.
external_issue: https://github.com/ArcadeAI/safeword/issues/1909
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/1917
phase_anchors:
  - "define-behavior: .project/tickets/P0D6S2-trustworthy-advisory-pr-review/spec.md"
  - "scenario-gate: features/trustworthy-advisory-pr-review.feature"
created: 2026-08-04T14:09:04.396Z
last_modified: 2026-08-04T16:55:56Z
---

# Route every ready PR with one trustworthy advisory review

**Goal:** Give every ready substantive PR one current evidence-bounded advisory result that routes uncertain or risky changes to a human.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-05T14:38:52Z Split accepted at the plan-implementation checkpoint. Promoted this ticket to an epic with three ordered children: HXT3GW ships the advisory-only exact-head MVP; Z7M7Y3 adds freshness reuse, inline finding lifecycle, and noise reduction; 436EQW adds controlled execution and exact remedy verification. The MVP deliberately performs no customer-code execution and fully re-reviews every new SHA.
- 2026-08-05T01:54:26Z Applied all quality-review suggestions before implementation planning: specified no-review receipt evidence, required finding-count telemetry on the human-routing path, and made unprivileged fork inspection / isolated privileged publication an explicit behavioral seam.
- 2026-08-04T16:55:56Z Scenario gate APPROVED by independent Claude review (`cross-agent`; stamp recorded). No build-only kill-risk requires a spike. Advanced to plan-implementation; carry explicit forbidden-action sentinels and a serialized trigger-claim seam into the proof plan.
- 2026-08-04T15:22:00Z User confirmed the revised scenarios are complete and asked to proceed. Advanced define-behavior → scenario-gate with the feature source anchored for independent review.
- 2026-08-04T14:11:06Z Intake converged from issue #1909 after reading parent epic #1908 and draft PR #1917. The user's explicit instruction to proceed confirms the existing issue scope; the draft and preserved spike are evidence, not proof. Advanced to define-behavior.
- 2026-08-04T14:09:04.396Z Started: Created ticket P0D6S2
