---
id: YCFFNC
slug: migrate-planning-guidance-without-disrupting-features
type: feature
phase: scenario-gate
status: in_progress
phase_skips:
  - "intake: originally inherited the 2026-09-08 approval of 82T411; that approval is stale after material parent changes, so this child cannot earn another approval or enter implementation until 82T411 receives fresh Product Plan approval"
  - "define-behavior: partitioned the accepted 82T411 Rule and scenario packet at Safeword's documented split restart point"
phase_anchors:
  - scenario-gate: features/migrate-planning-guidance-without-disrupting-features.feature
scope:
  - replace legacy feature-design routes with Implementation Plan and Execution Plan guidance
  - route architecture and data guidance by semantic applicability and durable significance
  - migrate in-flight feature tickets without retroactively blocking accepted implementation work
  - reconcile plan claims against current behavior when existing implementation returns to planning and preserve discrepancies as unresolved state
  - deliver both planning-phase contracts, the feature Delivery Checklist, and reviewable pull-request slicing through every affected host and collect real-boundary behavior proof or a specific justified host limitation
  - prove that a plain feature prompt automatically travels through the full workflow into a verified, review-ready pull request with strong Product, Implementation, and Execution Plans preserved
out_of_scope:
  - defining plan contracts, review infrastructure, execution decomposition, and small-work routing
done_when:
  - installed guidance names one feature design record and no legacy design artifact lane
  - data and architecture routing uses semantic triggers rather than file or entity counts
  - pre-implementation tickets migrate while already accepted implementation continues until it returns to planning
  - a returned or retrofitted plan cannot silently rewrite current implementation as accepted, proven, or approved design
  - every affected host executes the installed Implementation Planning, Execution Planning, feature-checklist, and PR-slicing behavior at its real boundary or records a specific justified limitation
  - on each supported authoritative host, a plain request such as MCP notification support can travel from intake to a completed, review-ready pull request without manual workflow orchestration or loss of planning quality
product_plan_contract: v1
parent: 82T411
blocked_on: [82T411]
parent_job: plan-implementability.TBU1
milestone: M2
created: 2026-09-08T17:36:35.373Z
last_modified: 2026-09-09T23:39:27.000Z
parent_contract_digest: b673888e6e44b77dfa690acf7450e2b8aebccb654631ffa83eaea838d0737ea9
---

# Migrate planning guidance without disrupting features

**Goal:** Replace legacy design routes and move in-flight features into the two-phase workflow safely

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-09T23:39:27.000Z Killer Demo addition: User added the full golden journey—a plain feature prompt such as MCP notification support should travel automatically from intake through high-quality Product, Implementation, and Execution Plans, TDD delivery, verification, checklist completion, and a completed review-ready PR. This child owns installed end-to-end proof while preserving human review and merge authority.

- 2026-09-09T23:10:11.000Z Parent reconciliation: `--accept` updated the current parent-contract digest to `121e39ab36468567b69d2bd4f1532aba13917bc9e412a411e8a4c2d2d11a44e9` after the 23:04 Product Plan changes.

- 2026-09-09T22:57:07.000Z Lineage correction: Parent TBU1 now explicitly owns reconciliation between a retrofitted plan and existing implementation, so parent reconciliation can detect changes to this child's R6 obligation.

- 2026-09-09T22:44:47.000Z Scenario impact: The previously approved packet predates R7 and must add installed cross-host proof for both phase gates and artifacts, the feature checklist, and PR slicing before fresh review.

- 2026-09-09T22:38:07.000Z Proof-boundary correction: Explicitly included the feature Delivery Checklist and reviewable-PR slicing in this M2 child's cross-host installation and real-boundary evidence obligation.

- 2026-09-09T22:33:02.000Z Ownership correction: Made the host-delivery promise explicit. This M2 child now owns the installed real-boundary proof that the M1 plan-contract children defer on every affected host.

- 2026-09-09T22:33:02.000Z Reconciliation evidence: Direct no-accept checks reported both this ticket and 26FK42 healthy against the current parent digest; their earlier timestamps did not indicate stale digests.

- 2026-09-09T22:19:12.000Z Review gate correction: Recorded the stale 82T411 Product Plan approval as an explicit blocker before another child approval or implementation transition.

- 2026-09-08T17:36:35.373Z Started: Created ticket YCFFNC

- 2026-09-08T18:05:00.000Z Define behavior: Bounded this child to legacy guidance and in-flight-ticket migration across five inherited obligations.

- 2026-09-08T18:20:00.000Z Scenario gate: Partitioned 5 inherited Rules into child-owned scenarios and R/G/R ledger entries; independent scenario review remains pending.

- 2026-09-09T16:18:00.000Z Returned to scenario gate: Tightened in-flight migration after a real retrofitted plan exposed plausible prose that did not literally match the current implementation. Returning work now reconciles plan claims against current behavior and preserves mismatches without rewriting history.

- 2026-09-08T18:37:46.090Z Scenario gate: Fresh-context degraded review requested changes. Added preservation and carry-forward behavior for accepted legacy design artifacts; current approval remains pending.

- 2026-09-09T00:10:00.000Z Scenario gate: Claude Opus independently approved the 16-scenario packet with cross-agent provenance (review `dc06424a-98d4-49d4-a9ec-387c4adb3ab2`); recorded the terminal review stamp and advanced to Implementation Planning.
