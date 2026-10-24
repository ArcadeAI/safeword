---
id: 1AHFZS
slug: review-complete-branch-before-finishing
type: feature
phase: scenario-gate
status: in_progress
phase_anchors:
  - define-behavior: .project/tickets/1AHFZS-review-complete-branch-before-finishing/spec.md
  - scenario-gate: packages/cli/features/review-complete-branch-before-finishing.feature
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
