---
id: G1C9PP
slug: approve-coherent-implementation-plans
type: feature
phase: plan-implementation
status: in_progress
phase_skips:
  - "intake: originally inherited the 2026-09-08 approval of 82T411; that approval is stale after material parent changes, so this child cannot earn another approval or enter implementation until 82T411 receives fresh Product Plan approval"
  - "define-behavior: partitioned the accepted 82T411 Rule and scenario packet at Safeword's documented split restart point"
phase_anchors:
  - scenario-gate: features/approve-coherent-implementation-plans.feature
  - plan-implementation: .project/tickets/G1C9PP-approve-coherent-implementation-plans/impl-plan.md
scope:
  - define Implementation Planning as the phase that resolves and approves behavior-shaping approach decisions
  - make the project-local Implementation Plan the single design record for architecture, data, rollout, rollback, and proof-scope choices
  - require compact, evidence-backed decision summaries that support a focused 30–60 minute review
  - give reviewers an architecture-at-a-glance mental model, explicit unresolved-decision state, and consequences for every accepted persona
  - distinguish proposed design, existing implementation, available proof, known defects, and pending human authority when those states coexist
  - apply the existing optional human design approval once to the reviewed approach without duplicating it after Execution Planning or deadlocking headless work
  - require decision-depth state and measurement models when significant behavior depends on them
  - repair incomplete or incorrect plans by returning to decision discovery, filling the known gaps through the proper decision owners, and re-reviewing the corrected plan
out_of_scope:
  - execution sequencing, coding instructions, exact test commands, and first-RED mechanics
  - review transport, provenance, invalidation, fallback, and migration behavior
done_when:
  - every in-scope behavior-shaping choice is decided or explicitly marked not applicable before Execution Planning
  - load-bearing choices record credible alternatives and current evidence without prescribing one table format
  - semantic review can judge the plan in a focused meeting and names execution detail that obscures a decision
  - applicable data decisions cover purpose, ownership, identity and integrity, lifecycle and retention, migration, and rollback without embedding execution instructions
  - a plan cannot imply that implemented means proven or that independent review means human approval
  - significant concurrency, security, durability, lifecycle, migration, compatibility, and quantitative choices are sufficiently decided without absorbing execution mechanics
  - human design approval, when configured, is requested once on the reviewed approach and remains honestly pending where the surface cannot collect it
  - an incomplete or incorrect plan is iteratively completed and corrected rather than ending at a rejection message
product_plan_contract: v1
parent: 82T411
blocked_on: [82T411]
parent_job: plan-implementability.TBU1
milestone: M1
created: 2026-09-08T17:36:33.419Z
last_modified: 2026-09-10T01:38:23.000Z
parent_contract_digest: c08988d3ae35252d5e18057f1332f7638bf55dfc0a4b230581386afac25da34a
---

# Approve coherent Implementation Plans

**Goal:** Make every feature approach complete, reviewable, and evidence-backed before sequencing

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-10T01:38:23.000Z Scenario gate: The standard coordinator's Claude Opus and Sonnet routes timed out on the final 31-scenario packet (`6331924c-3fbd-402e-973d-4c19c0111d53`). Under the configured `prefer` policy, the required one-shot fallback completed a main-thread review with no remaining findings after the exact Rule text, approval boundary, and iterative repair convergence were tightened. Advanced without an independent stamp; independence remains honestly recorded as none.

- 2026-09-09T23:38:16.000Z Killer Demo correction: User clarified that finding an incomplete plan is not the payoff. This child now owns the return-to-planning loop that exposes the full current defect set, fills the missing decisions through their proper owners, and re-reviews corrected bytes until the plan is complete and correct or honestly waiting on external authority.

- 2026-09-09T23:10:11.000Z Parent reconciliation: `--accept` updated the current parent-contract digest to `02ab8c3c4aa97ca39513ebeb214c703297132ee82a970296738d56fc16368f70` after the 23:04 Product Plan changes.

- 2026-09-09T22:57:07.000Z Lineage correction: Parent TBU1 now explicitly owns this child's persona-consequence discovery and planning-versus-implementation state-separation obligations, so parent reconciliation can detect changes to them.

- 2026-09-09T22:28:06.000Z Ownership correction: Moved the one-time human approach-approval obligation here so this TBU1 child owns and digests the parent Rule it implements.

- 2026-09-09T22:19:12.000Z Review gate correction: Recorded the stale parent approval as an explicit blocker; existing scenario work is preserved, but this child cannot earn another approval or enter implementation until 82T411 is freshly approved.

- 2026-09-08T17:36:33.419Z Started: Created ticket G1C9PP

- 2026-09-08T18:05:00.000Z Define behavior: Bounded this child to approach-decision quality and 15 inherited obligations.

- 2026-09-08T18:20:00.000Z Scenario gate: Partitioned 15 inherited Rules into child-owned scenarios and R/G/R ledger entries; independent scenario review remains pending.

- 2026-09-08T18:37:46.090Z Scenario gate: All independent routes were exhausted. Main-thread supplemental review found no must-fix issue; no independent stamp was written, so the child remains at scenario-gate.

- 2026-09-08T21:04:19.000Z Scenario gate: Claude Opus independently approved the 22-scenario packet with cross-agent provenance (review `0ad646fa-3cb4-4a70-ab08-f76ce397ff6e`); recorded the scenario-gate stamp and advanced to Implementation Planning. Non-blocking review warnings remain inputs to implementation planning.

- 2026-09-09T05:11:30.000Z Implementation planning: Claude Opus independently approved the final current Implementation Plan with cross-agent provenance (review `2002755a-92f9-4560-af5b-459f0283077c`). The trusted receipt stamp was recorded through the cache-busted distribution bundle, and the ticket advanced to implementation; sibling delivery prerequisites remain explicit in the plan.

- 2026-09-09T16:18:00.000Z Returned to scenario gate: A real emergency-control plan review showed four material requirements the existing contract implied but did not state strongly enough—an architecture-at-a-glance mental model, persona consequence coverage, decision-bearing data depth, and explicit separation of proposed, implemented, proven, defective, and human-authority states. Preserved completed TDD evidence while reopening the affected scenarios and plan.

- 2026-09-09T21:49:00.000Z Scenario impact: Added decision-depth state/authority/atomicity/retry/evidence modeling for significant workflows and split quantitative ownership across Product, Implementation, and Execution Planning. Existing scenario coverage must be updated before this child can leave scenario gate.

- 2026-09-09T22:03:00.000Z Review correction: Restored the complete parent-owned data-decision surface in the child Rule, including store/model, schema/relationships, source of truth, access, cross-system flow, backfill, and compliance.

- 2026-09-09T22:09:00.000Z Review correction: Preserved M1 as contract definition by adding explicit affected-surface skips; YCFFNC in M2 owns installed host delivery and real-boundary proof.
