---
id: Z7M7Y3
slug: keep-advisory-reviews-current-without-repeated-noise
type: feature
phase: plan-implementation
status: in_progress
parent: P0D6S2
epic: trustworthy-advisory-pr-review
blocked_on: [HXT3GW]
phase_skips:
  - "intake: inherited the accepted P0D6S2 intake when the user approved the plan-implementation split"
  - "define-behavior: extracted from the P0D6S2 behavior packet at the documented split restart point"
  - "scenario-gate: inherited the independently approved P0D6S2 scenario gate before narrowing to this child"
scope:
  - Prove inert exclusions and publish evidence-rich no-review receipts for all-inert changes.
  - Reuse a prior conclusion only across a proven immaterial update with an explicit freshness bridge.
  - Publish findings as exact-SHA inline comments and suppress unchanged findings across material revisions.
  - Mark prior findings resolved or superseded when their supporting evidence disappears.
out_of_scope:
  - Core exact-head advisory routing and safe publication, supplied by HXT3GW.
  - Customer-code execution and verified remedies, owned by 436EQW.
done_when:
  - All-inert changes avoid model review only with recorded exclusion evidence.
  - Proven immaterial updates preserve a conclusion with an auditable freshness bridge; uncertainty forces a fresh review.
  - Unchanged findings are not reposted and resolved findings leave the current conclusion.
  - Consequential findings can be published inline against the exact reviewed SHA.
phase_anchors:
  - "define-behavior: .project/tickets/Z7M7Y3-keep-advisory-reviews-current-without-repeated-noise/spec.md"
  - "scenario-gate: features/keep-advisory-reviews-current-without-repeated-noise.feature"
  - "plan-implementation: features/keep-advisory-reviews-current-without-repeated-noise.feature"
created: 2026-08-05T14:38:52.620Z
last_modified: 2026-08-05T14:38:52.620Z
---

# Keep advisory reviews current without repeated noise

**Goal:** Preserve trustworthy freshness while reducing repeated review work and finding noise across revisions.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-05T14:38:52Z Restarted at plan-implementation from the accepted P0D6S2 split; sequenced after HXT3GW so freshness and noise optimizations extend a stable receipt contract.
- 2026-08-05T14:38:52.620Z Started: Created ticket Z7M7Y3
