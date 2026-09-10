---
id: 7CAMAD
slug: turn-decisions-into-startable-work
type: feature
phase: plan-implementation
status: in_progress
phase_skips:
  - "intake: originally inherited the 2026-09-08 approval of 82T411; that approval is stale after material parent changes, so this child cannot earn another approval or enter implementation until 82T411 receives fresh Product Plan approval"
  - "define-behavior: partitioned the accepted 82T411 Rule and scenario packet at Safeword's documented split restart point"
phase_anchors:
  - scenario-gate: features/turn-decisions-into-startable-work.feature
scope:
  - turn a reviewed current Implementation Plan into dependency-ordered build and test work
  - own the integrated demo continuation: turn the complete and correct accepted Implementation Plan into an Execution Plan, then begin the first RED step without inventing a decision
  - map every accepted behavior, decision, proof, migration, rollout, rollback, and surface obligation to startable steps
  - return discoveries only when they alter an accepted decision or proof boundary
  - distinguish current implementation, target work, evidence currency, and pending human authority
  - apply the accepted dependency-direction invalidation matrix when upstream scope, behavior, or either plan changes
  - carry the feature Delivery Checklist and map work into dependency-ordered tasks and independently reviewable pull-request slices
  - turn accepted measurement decisions into concrete instrumentation and evidence collection
  - return implementation-time decisions to the plan they change, re-review every invalidated downstream plan, preserve still-valid work and evidence, and resume from the first affected obligation
out_of_scope:
  - choosing architecture, API, data, authorization, compatibility, rollout, rollback, or proof-scope decisions
  - implementing review transport, provenance, fallback, and work-type classification mechanics
  - claiming completed implementation, passed verification, release approval, or merge authority from Execution Plan approval
done_when:
  - after G1C9PP proves the plan-repair loop, a fresh-context agent turns the complete and correct accepted Implementation Plan into startable work and begins the first RED step without inventing a decision
  - every accepted obligation maps to owned work, dependencies, proof mechanics, and completion evidence
  - decision changes return to Implementation Planning with completed evidence preserved
  - the reviewed plan records current-to-target work, honest proof strength, the Delivery Checklist, and coherent PR slices without overstating approval
  - every accepted measurement decision has startable instrumentation, test, and evidence work without changing the upstream promise
  - a design-changing implementation decision repairs and re-approves both plans before work resumes, while a sequencing-only decision repairs and re-approves only the Execution Plan
product_plan_contract: v1
parent: 82T411
blocked_on: [82T411]
parent_job: plan-implementability.TBU2
milestone: M1
depends_on: [G1C9PP, 6XW8H7, A639WN]
created: 2026-09-08T17:36:33.908Z
last_modified: 2026-09-10T01:57:42.000Z
parent_contract_digest: c107ca39dc842a473be4ea5e12c6d448d12ccccd211da65b92ec3b689c03c8a3
---

# Turn accepted decisions into startable work

**Goal:** Produce an Execution Plan a fresh agent can begin without inventing a contract

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-10T01:57:42.000Z Scenario gate: Claude Opus independently approved the final 34-scenario packet with cross-agent provenance (review `61c07e08-c577-4438-88d6-2e59829567aa`). The authenticated scenario-gate stamp was written through the same cache-busted distribution bundle that produced the review, and the child advanced to Implementation Planning.

- 2026-09-09T23:42:56.000Z Killer Demo addition: User added implementation-time replanning. A decision that changes the accepted approach returns through revised and re-reviewed Implementation and Execution Plans; a sequencing-only decision returns through the Execution Plan; both preserve still-valid evidence and resume from the first invalidated obligation.

- 2026-09-09T23:38:16.000Z Killer Demo correction: G1C9PP now owns completing and correcting an inadequate Implementation Plan; this child owns the continuation from the accepted plan through the Execution Plan to the first RED step without a newly invented decision.

- 2026-09-09T23:10:11.000Z Parent reconciliation: `--accept` updated the current parent-contract digest to `6adb25eca1ec5ca8e510dca085cd14539ff08e37d2085f0190d7891c10c0c2a8` after the 23:04 Product Plan changes.

- 2026-09-09T23:04:09.000Z Dependency and demo correction: The integrated Execution Plan now consumes A639WN's evidence taxonomy, and the demo scenario explicitly requires the cold-start agent's semantic review—not a structural gate—to reject the unresolved decision.

- 2026-09-09T22:57:07.000Z Scope correction: Made the TBU2 invalidation decision matrix explicitly in scope while leaving review transport, provenance, and fallback mechanics with 5F5ZZA.

- 2026-09-09T22:44:47.000Z Scenario impact: R15 measurement mechanics, R16 invalidation ownership, and the complete rejection-then-correction demo require updated scenarios before this child can receive a fresh scenario-gate review.

- 2026-09-09T22:38:07.000Z Digest-ownership correction: Added the parent TBU2 review-invalidation rule directly to this TBU2 child; 5F5ZZA still owns the shared provenance mechanics under TBU4.

- 2026-09-09T22:33:02.000Z Demo correction: Assigned this child the complete inherited cold-start sequence at the Safeword CLI boundary—reject the missing contract, accept the correction, then begin the first RED step without a new behavior-shaping decision.

- 2026-09-09T22:28:06.000Z Dependency correction: The integrated Execution Plan contract now follows the M1 Implementation Plan, PR-slicing, and feature-checklist contracts instead of depending on a checklist child placed in M3.

- 2026-09-09T22:19:12.000Z Review gate correction: Restored Safeword CLI as the M1 real boundary that proves the inherited cold-start demo, and recorded the stale parent approval as an explicit blocker before another approval or implementation transition.

- 2026-09-08T17:36:33.908Z Started: Created ticket 7CAMAD

- 2026-09-08T18:05:00.000Z Define behavior: Bounded this child to executable decomposition and 11 inherited obligations.

- 2026-09-08T18:20:00.000Z Scenario gate: Partitioned 11 inherited Rules into child-owned scenarios and R/G/R ledger entries; independent scenario review remains pending.

- 2026-09-08T18:37:46.090Z Scenario gate: All independent routes were exhausted. Main-thread supplemental review strengthened current-plan states, executable first RED, and full obligation mapping; no independent stamp was written.

- 2026-09-08T21:57:30.000Z Scenario gate: Claude Opus independently approved the 25-scenario packet with cross-agent provenance (review `5a84c4b1-c500-4e72-882b-5a5f67b89068`); recorded the scenario-gate stamp and advanced to Implementation Planning. Non-blocking review warnings remain planning inputs.

- 2026-09-09T16:45:00.000Z Returned to scenario gate: A real plan-tightening exercise clarified that the Execution Plan must own current-to-target state, evidence currency, the Delivery Checklist, and reviewable PR decomposition, and that its approval establishes startable delivery rather than implementation, verification, release approval, or merge authority. Preserved the previously approved scenarios while reopening the expanded contract.

- 2026-09-09T21:49:00.000Z Scenario impact: Added the Execution-owned side of quantitative contracts—concrete instrumentation, tests, and evidence collection—without allowing execution planning to redefine the upstream promise or measurement validity decision.

- 2026-09-09T22:09:00.000Z Review correction: Preserved M1 as contract definition by adding explicit affected-surface skips; YCFFNC in M2 owns installed host delivery and real-boundary proof.
