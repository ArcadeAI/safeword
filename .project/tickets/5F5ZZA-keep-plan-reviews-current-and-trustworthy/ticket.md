---
id: 5F5ZZA
slug: keep-plan-reviews-current-and-trustworthy
type: feature
phase: scenario-gate
status: in_progress
phase_skips:
  - "intake: originally inherited the 2026-09-08 approval of 82T411; after material parent changes, 82T411 was freshly approved and this child was reconciled before scenario review resumed"
  - "define-behavior: partitioned the accepted 82T411 Rule and scenario packet at Safeword's documented split restart point"
phase_anchors:
  - scenario-gate: features/keep-plan-reviews-current-and-trustworthy.feature
scope:
  - give both plan reviews a canonical contract, complete resolved context, and content-derived identity
  - bind receipts to the plan and semantically relevant context so meaningful changes invalidate dependent approvals
  - prefer independent review and record exhausted-route fallback honestly
  - preserve evidence, privacy, licensing, attribution, and code-execution trust boundaries
  - give Product, Implementation, and Execution Planning the same explicit contract shape without collapsing their approval meanings
  - keep blocking findings grounded in accepted requirements without turning reviewer suggestions into decisions or scope
  - resolve the accepted boundary from ticket, project, milestone, and parent context and check both omissions and overreach without changing scope
  - make Product Plan review enforce persona-outcome coverage and visibly separate facts, assumptions, and unresolved product decisions
out_of_scope:
  - defining Implementation Plan approach content, defining Execution Plan decomposition content, changing accepted scope, and migration policy
done_when:
  - missing, unreadable, stale, or digest-mismatched required context cannot produce approval
  - semantic context changes invalidate dependent receipts while formatting and unrelated inventory changes do not; exact plan changes invalidate their own review except normalized Execution Plan checklist progress
  - receipts identify the plan, context, reviewer route, and achieved independence without overstating fallback quality
  - each phase contract declares its purpose, entry, required and prohibited content, review question, approval meaning, invalidation, and return path, and no approval claims a downstream state
  - corrected plans require a fresh exact-byte verdict and optional reviewer strengthening cannot fail a gate before user acceptance
  - review and guidance cannot add out-of-scope behavior, design, proof, or work without user authority
  - Product Plan approval cannot pass while an accepted persona outcome is neither inventoried nor explicitly inapplicable, or while facts, assumptions, and unresolved decisions are conflated; scenario review separately proves applicable-outcome coverage
product_plan_contract: v1
parent: 82T411
blocked_on: [82T411]
parent_job: plan-implementability.TBU4
milestone: M2
created: 2026-09-08T17:36:34.390Z
last_modified: 2026-09-10T03:36:35.000Z
parent_contract_digest: 2afd2f5559eafea9bd752ac826b46fa98e80a30ccdf6bed76a16ff7f30bcec20
---

# Keep plan reviews current and trustworthy

**Goal:** Bind planning approvals to canonical contracts, complete context, honest independence, and semantic changes

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-10-07 Main-integration suite result: CLI 660 files passed, one failed; 10929 tests passed, one failed, 14 skipped, exit 1, 657.80s. Retro relay passed 198 tests with one skip; retro collector passed 153 tests. The sole CLI failure occurred at `git add -A` before the assertion: Git could not create a temporary object (`Invalid argument`) while indexing the installed interface-contract guide. The exact original boundary test file then passed unchanged, all 12 tests, in 9.10s (`/tmp/4200-guide-main-boundary-isolated.log`). This identifies fixture staging rather than phase-skip validation as the failing boundary; the underlying intermittent filesystem cause is not established. Disk capacity is ample. No test, retry policy, tool pin or production workaround was changed. The full run remains a failed run, not reclassified as green; a later final integrated-head full check remains required. Frozen install and all 275 template pairs/11 contracts pass. This is an integration checkpoint, not epic completion or PR readiness.

- 2026-10-07 Main-integration full-suite investigation: the active run reports one failure in `does not flag born-past-intake when phase_skips justify the birth (negative)`. No test or production fix applied. Competing causes: phase-skip validation regression, generated CLI mismatch, or a suite/environment interaction. Direct current-source `evaluateTicketWrite` accepts the exact skip list (`/tmp/4200-boundary-birth-pure.log`); a fresh installed Cursor project through the built CLI returns exit 0 with only the unrelated missing-ledger warning and no birth finding (`/tmp/4200-boundary-birth-repro.log`). These checks rule out a simple validator failure and consistent built-CLI mismatch. The exact full-suite assertion output and isolated original test rerun remain required before assigning a root cause. Full-suite evidence is retained in `/tmp/4200-guide-main-full.log`.

- 2026-10-06 Main integration: merged `485d8ac773af44e73dbcd8c2ea64f08e5fee5154` into the guide base. Preserved per-scenario ledger fingerprints together with main's current generated-target classification and authenticated exclusion revalidation. Typecheck and 173 targeted review/receipt/ledger tests pass. Independent Claude review `507706f1-41b3-4216-9e98-cdd079e9f6b6` approves the source/test union; inherited fail-safe under-credit warnings remain, without expanding this integration. Frozen install passes using the pinned launcher from the PR5 checkout because this lower branch predates the toolchain slice. The initial local-launcher attempt failed because that file is absent here; no shell profile or repository pin changed.

- 2026-10-06 Generated integration evidence: first generation stopped on a Cursor install result-hash change against the temporary main fixture used for conflict resolution. Investigated all 12 regenerated lifecycle results: each matches the original guide-branch HEAD, including Cursor install `1f3c3174135d276fe41de6b44e23ff96f100c35f8d97264f483a1fd663a9ccb8`. Thus the warning reflects the different main placeholder rather than a new feature behavior. Reran all five generators in safe order and verified them successfully. Logs: `/tmp/4200-guide-main-generated.log`, `/tmp/4200-guide-main-generated-verified.log`, `/tmp/4200-guide-main-targeted.log`, `/tmp/4200-guide-main-typecheck.log`. Full repository tests are still running; no full-suite success or whole-PR readiness is claimed.

- 2026-09-10T03:36:35.000Z Scenario gate approved: Independent Claude Opus review `907bfbe5-0e30-437f-9bd8-492366879e33` approved the final 44-scenario review-trust contract with cross-agent independence. Advanced to Implementation Plan drafting; no plan anchor exists yet.

- 2026-09-09T23:10:11.000Z Parent reconciliation: `--accept` refreshed this child against the approved Product Plan after the 23:04 changes; the current digest is recorded in frontmatter and passes `ticket reconcile-parent`.

- 2026-09-09T23:04:09.000Z Contract and scenario impact: Clarified that this child defines shared contract shape and Product Plan outcome inventory, while G1C9PP and 7CAMAD own their plan content and scenario review separately proves outcome coverage. R11–R16 require new scenario coverage before fresh review.

- 2026-09-09T22:44:47.000Z Contract-ownership correction: Assigned the Product Plan's persona-outcome coverage and epistemic-status requirements to this child alongside the shared phase-contract shape.

- 2026-09-09T22:28:06.000Z Ownership correction: Absorbed accepted-boundary resolution, omission and overreach review, and reviewer non-authority from K3EBHB so the TBU4 child owns and digests those TBU4 Rules.

- 2026-09-09T22:19:12.000Z Review gate correction: Recorded the stale parent approval as an explicit blocker; existing scenario work is preserved, but this child cannot earn another approval or enter implementation until 82T411 is freshly approved.

- 2026-09-08T17:36:34.390Z Started: Created ticket 5F5ZZA

- 2026-09-08T18:05:00.000Z Define behavior: Bounded this child to review integrity and nine inherited obligations.

- 2026-09-08T18:20:00.000Z Scenario gate: Partitioned 9 inherited Rules into child-owned scenarios and R/G/R ledger entries; independent scenario review remains pending.

- 2026-09-08T18:37:46.090Z Scenario gate: All independent routes were exhausted. Main-thread supplemental review strengthened required-context and semantic-invalidation partitions; no independent stamp was written.

- 2026-09-08T22:38:00.000Z Scenario gate: Claude Opus independently approved the 25-scenario packet with cross-agent provenance (review `77068d2f-e8ff-493a-ad23-d49ca5164b2f`); recorded the scenario-gate stamp and advanced to Implementation Planning. Non-blocking review warnings remain planning inputs.

- 2026-09-09T16:45:00.000Z Returned to scenario gate: Added the shared planning-contract shape and bounded approval meanings learned from the emergency-control plan. Product approval establishes the right behavior, Implementation approval the accepted design, and Execution approval startable delivery; none may claim a downstream state.

- 2026-09-09T21:49:00.000Z Scenario impact: Added the reviewed finding-quality boundary: blockers cite accepted requirements, reviewers expose rather than decide unresolved choices, optional strengthening remains nonblocking, and corrected plan bytes require a fresh verdict.
