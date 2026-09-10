---
id: 3EG00H
slug: keep-tasks-and-patches-proportional
type: feature
phase: scenario-gate
status: in_progress
phase_skips:
  - "intake: originally inherited the 2026-09-08 approval of 82T411; that approval is stale after material parent changes, so this child cannot earn another approval or enter implementation until 82T411 receives fresh Product Plan approval"
  - "define-behavior: partitioned the accepted 82T411 Rule and scenario packet at Safeword's documented split restart point"
phase_anchors:
  - scenario-gate: features/keep-tasks-and-patches-proportional.feature
scope:
  - classify patch, feature, and task work with one explicit precedence order
  - carry Delivery Checklist concerns proportionally in task and patch inline work records without introducing feature planning artifacts
  - prove the task-and-patch proportional-flow clause of the inherited Killer Demo alongside 7CAMAD's feature sequence
  - keep patches on targeted existing proof and tasks on inline test contracts with TDD
  - promote consequential in-scope decisions to the feature phase that owns them while preserving evidence
out_of_scope:
  - formal Implementation Plans, Execution Plans, and independent planning reviews for tasks or patches
done_when:
  - classification is total and patch routing cannot hide a feature signal
  - tasks and patches retain proportionate discovery and proof
  - their delivery obligations are proven, concretely skipped, or assigned as human dependencies without claiming merge authority
  - the integrated demo shows equivalent small work taking the lighter task and patch routes without entering either feature planning phase
  - promotion preserves completed evidence and names the phase where work resumes
product_plan_contract: v1
parent: 82T411
blocked_on: [82T411]
parent_job: plan-implementability.TBU3
milestone: M3
created: 2026-09-08T17:36:35.884Z
last_modified: 2026-09-09T23:10:11.000Z
parent_contract_digest: 4eb5badb7878b61e68e1840164e79a12e0f13dbf6c9a60c3295c84215d3fe514
---

# Keep tasks and patches proportional

**Goal:** Use lightweight decision discovery and proof without hiding feature-sized choices

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-09T23:10:11.000Z Parent reconciliation: `--accept` updated the current parent-contract digest to `329630bce1f22bae468e60b97bfcf8a1b5cc3cc9afa455fa3187b5b52975fdfc` after the 23:04 Product Plan changes.

- 2026-09-09T23:04:09.000Z Lineage correction: Removed feature-TDD sequencing from this TBU3 child after moving that obligation wholly into the TBU2 Execution Planning contract.

- 2026-09-09T22:44:47.000Z Demo and scenario impact: This child now owns the proportional task-and-patch clause of the inherited Killer Demo. Its scenario packet must be updated for the new checklist and TDD lineage Rules before fresh review.

- 2026-09-09T22:38:07.000Z Digest-ownership correction: Added the parent TBU3 rule that Execution Planning supplies rather than replaces feature TDD; 7CAMAD remains the feature-side consumer under TBU2.

- 2026-09-09T22:28:06.000Z Ownership correction: Added the TBU3-owned lightweight Delivery Checklist adaptation for tasks and patches and returned the stale scenario approval to scenario gate.

- 2026-09-09T22:19:12.000Z Review gate correction: Recorded the stale 82T411 Product Plan approval as an explicit blocker before another child approval or implementation transition.

- 2026-09-08T17:36:35.884Z Started: Created ticket 3EG00H

- 2026-09-08T18:05:00.000Z Define behavior: Bounded this child to proportional small-work routing and 13 inherited obligations.

- 2026-09-08T18:20:00.000Z Scenario gate: Partitioned 13 inherited Rules into child-owned scenarios and R/G/R ledger entries; independent scenario review remains pending.

- 2026-09-08T18:37:46.090Z Scenario gate: Fresh-context degraded review requested changes. Defined the narrow patch contract in behavior and limited formal return paths to feature or already-promoted work; current approval remains pending.

- 2026-09-09T00:28:00.000Z Scenario gate: Claude Opus independently approved the 25-scenario packet with cross-agent provenance (review `703ce753-213d-4932-91b2-45d75e97324a`); recorded the terminal review stamp and advanced to Implementation Planning.
