---
id: YCFFNC
slug: migrate-planning-guidance-without-disrupting-features
type: feature
phase: scenario-gate
status: in_progress
phase_skips:
  - "intake: inherited the independently approved 82T411 Product Plan when the user approved this split"
  - "define-behavior: partitioned the accepted 82T411 Rule and scenario packet at Safeword's documented split restart point"
phase_anchors:
  - scenario-gate: features/migrate-planning-guidance-without-disrupting-features.feature
scope:
  - replace legacy feature-design routes with Implementation Plan and Execution Plan guidance
  - route architecture and data guidance by semantic applicability and durable significance
  - migrate in-flight feature tickets without retroactively blocking accepted implementation work
out_of_scope:
  - defining plan contracts, review infrastructure, execution decomposition, and small-work routing
done_when:
  - installed guidance names one feature design record and no legacy design artifact lane
  - data and architecture routing uses semantic triggers rather than file or entity counts
  - pre-implementation tickets migrate while already accepted implementation continues until it returns to planning
product_plan_contract: v1
parent: 82T411
parent_job: plan-implementability.TBU1
milestone: M2
created: 2026-09-08T17:36:35.373Z
last_modified: 2026-09-08T17:36:35.373Z
parent_contract_digest: 7090ac023ba8bcfe32c15083ec499f8f0a143bdd6c20c20eec8ba484ecf3281c
---

# Migrate planning guidance without disrupting features

**Goal:** Replace legacy design routes and move in-flight features into the two-phase workflow safely

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-08T17:36:35.373Z Started: Created ticket YCFFNC

- 2026-09-08T18:05:00.000Z Define behavior: Bounded this child to legacy guidance and in-flight-ticket migration across five inherited obligations.

- 2026-09-08T18:20:00.000Z Scenario gate: Partitioned 5 inherited Rules into child-owned scenarios and R/G/R ledger entries; independent scenario review remains pending.

- 2026-09-08T18:37:46.090Z Scenario gate: Fresh-context degraded review requested changes. Added preservation and carry-forward behavior for accepted legacy design artifacts; current approval remains pending.
