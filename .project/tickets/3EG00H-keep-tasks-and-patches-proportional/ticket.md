---
id: 3EG00H
slug: keep-tasks-and-patches-proportional
type: feature
phase: scenario-gate
status: in_progress
phase_anchors:
  - scenario-gate: features/keep-tasks-and-patches-proportional.feature
scope:
  - classify patch, feature, and task work with one explicit precedence order
  - keep patches on targeted existing proof and tasks on inline test contracts with TDD
  - promote consequential in-scope decisions to the feature phase that owns them while preserving evidence
out_of_scope:
  - formal Implementation Plans, Execution Plans, and independent planning reviews for tasks or patches
done_when:
  - classification is total and patch routing cannot hide a feature signal
  - tasks and patches retain proportionate discovery and proof
  - promotion preserves completed evidence and names the phase where work resumes
product_plan_contract: v1
parent: 82T411
parent_job: plan-implementability.TBU3
milestone: M3
created: 2026-09-08T17:36:35.884Z
last_modified: 2026-09-08T17:36:35.884Z
parent_contract_digest: db3930e6a609f72ce0a6def3393fbedc137030153479e7a577b54becc8661e2c
---

# Keep tasks and patches proportional

**Goal:** Use lightweight decision discovery and proof without hiding feature-sized choices

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-08T17:36:35.884Z Started: Created ticket 3EG00H

- 2026-09-08T18:05:00.000Z Define behavior: Bounded this child to proportional small-work routing and 13 inherited obligations.

- 2026-09-08T18:20:00.000Z Scenario gate: Partitioned 13 inherited Rules into child-owned scenarios and R/G/R ledger entries; independent scenario review remains pending.
