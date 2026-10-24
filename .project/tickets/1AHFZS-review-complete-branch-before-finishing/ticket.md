---
branch_review_exit_id: 3eabfed2-3d5a-442f-be96-a70357fc6cb0
id: 1AHFZS
slug: review-complete-branch-before-finishing
type: feature
phase: implement
status: in_progress
phase_anchors:
  - define-behavior: .project/tickets/1AHFZS-review-complete-branch-before-finishing/spec.md
  - scenario-gate: packages/cli/features/review-complete-branch-before-finishing.feature
  - implement: .project/tickets/1AHFZS-review-complete-branch-before-finishing/execution-plan.md
scope:
  - make the existing BDD implementation-exit quality review select the merge-base-to-HEAD branch change set and ticket behavior context automatically
  - review eligible authored changes in bounded passes while accounting for every changed path, including deletes, renames, generated output, and unavailable evidence
  - report base and head revisions, findings, reviewed and omitted paths, and whether the branch evidence is complete, partial, or absent and current or stale
  - require a fresh review after later changes to implementation, tests, scenarios, or ticket goals while allowing routine verify and closure records
  - keep the branch review available through the shared Safeword CLI and supported local agent workflows
out_of_scope:
  - adding a review event on every edit or every RED/GREEN step
  - replacing PR readiness, GitHub PR review, or human approval
  - silently treating uncommitted changes, oversized authored files, missing review passes, or generated skips as complete coverage
  - treating phase, timestamp, Work Log, verification, or audit bookkeeping alone as new implementation work
  - promising exhaustive semantic understanding across bounded review passes
done_when:
  - a representative multi-scenario branch review includes the ticket context and accounts for every merge-base-to-head path at the reviewed head
  - findings are actionable and prioritized, and every omitted or unavailable path is named without a clean or complete claim
  - implementation exit recomputes the base and checks the reviewed branch snapshot before the phase change; later reviewable work changes require a fresh review while routine ticket bookkeeping does not
  - an empty branch inventory says no branch changes were reviewed and cannot satisfy the multi-loop review requirement by itself; missing base and partial coverage are reported honestly with the existing fallback or reasoned-skip path
  - bounded packet and supported host behavior are verified without adding another review stage
product_plan_contract: v1
created: 2026-10-02T05:17:41.443Z
last_modified: 2026-10-23T00:00:00.000Z
---

# Review complete branch changes before builders finish

**Goal:** Give builders a task-aware review of the entire branch at BDD implementation exit with honest coverage and actionable findings

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-10-24 Scenario review renewal: All twenty-two examples passed again under receipt 5c172d9b-975e-4b7b-8331-de265c8df17b after the spec stopped stating an in-progress review status.

- 2026-10-24 Scenario review: All twenty-two examples, including rejection of caller-selected files, passed independent review under receipt fb719578-bf26-4f68-97c3-9fa7e5e9738f. The earlier pending note below is superseded; the spec now records stable behavior rather than an in-progress review status.

- 2026-10-24 Scenario repair: Independent review found that an oversized authored file could be unaccounted for. Added a twenty-first example under the accepted incomplete-coverage rule; renewed review is pending.

- 2026-10-24 Scenario repair: Added the changed-path example for deleted, renamed, and force-added ignored files inside the builder-approved scope. The resulting twenty scenarios passed independent review under receipt 7663f1ba-de08-48a3-b6ea-2ec19c8e88a7; this replaces the older nineteen-scenario account below.

- 2026-10-23 Scenario repair review: Claude reviewed all nineteen exact scenarios under receipt f28486d9-badc-4255-969a-62c19d49c8a7 and approved with no blocking findings. The builder's earlier approval covered fifteen examples; four later examples stay inside the same approved Rules and out-of-scope line, and the builder asked us to proceed until done. No new product-scope decision was made.

- 2026-10-23 Scenario repair: Executable RED review showed the accepted later-base example described an inventory response while the approved CLI design rejects that request. Reworded that example to assert refusal and added one example for a project integration ref pointing at its own topic branch. This is the same branch-narrowing rule, now with two distinct input paths; nineteen scenarios await fresh review.

- 2026-10-23 Scenario accounting: The original fifteen user-approved examples remain. Subsequent review added three examples inside the same accepted rules; the current feature file has eighteen scenarios. The Vitest proof-routing tag changes test selection only.

- 2026-10-23 Replay: A fresh independent scenario review found two promised behaviors without discriminating examples: ticket-goal changes must stale a saved review, and a missing integration base must not claim coverage. Returned to scenario-gate and added those two examples within the existing scope.

- 2026-10-02T05:17:41.443Z Started: Created ticket 1AHFZS
- 2026-10-02T05:19Z Found: BDD implementation exit already requests a whole-diff quality review, but the shared review packet only contains caller-selected bounded files. PR readiness separately requires current-head complete-diff author review. Drafted Product Bet and two builder jobs; awaiting the first BDD checkpoint.
- 2026-10-23 Resumed: Fast-forwarded the feature checkout from c122f7b97 to origin/main f211c4c30. PR #5151 is merged; the remaining BDD gap is branch-wide selection, task context, honest coverage, and freshness at implementation exit. Product Bet and jobs were previously accepted; Rules await confirmation.
- 2026-10-23 Decision: User authorized the existing implementation-exit review path after an evidence-backed comparison with guidance-only and early PR review. Updated the Product Plan and scope to make branch inventory, bounded review, omissions, and freshness explicit.
- 2026-10-23 Decision: User chose agent acknowledgement with clear disclosure when a branch review omits evidence; no user approval is needed for that incomplete result. Scenario-set confirmation remains pending after a plain-language walkthrough.
- 2026-10-23 Design decision: After independent quality review found that a full Git/ticket snapshot would go stale on normal verify and closure writes, user authorized a revised BDD draft. Implementation exit checks the full reviewed snapshot; later checks watch implementation, tests, scenarios, and ticket goals, excluding routine phase and evidence bookkeeping. An empty branch diff cannot claim a completed branch review. Scenario completeness still awaits user confirmation.
- 2026-10-23 Scenario decision: User approved the revised thirteen-scenario behavior set, including later code changes needing a fresh review and routine ticket bookkeeping not restarting the review. Proceeding through the required define-behavior and scenario review gates.
- 2026-10-23 Scenario review: Independent reviewer found that the gate needed both a valid-review exit case and a missing-acknowledgement refusal case. Added those two examples within the approved Rules; the current draft has fifteen scenarios and awaits the user's completeness check before leaving scenario-gate.
- 2026-10-23 Scenario decision: User confirmed the final fifteen examples and that neither added example exceeds the agreed scope. The independent scenario review had no blocking findings; rerunning it against this recorded confirmation before the phase stamp.
