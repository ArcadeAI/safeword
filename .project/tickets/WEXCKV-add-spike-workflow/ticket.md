---
id: WEXCKV
slug: add-spike-workflow
type: feature
phase: verify
status: in_progress
phase_skips:
  - intake: User confirmed the bounded spike scope before the first ticket snapshot was committed.
  - define-behavior: The spec and behavior review were completed before the first ticket snapshot was committed.
  - scenario-gate: The executable scenarios and independent scenario review were completed before the first ticket snapshot was committed.
  - plan-implementation: The implementation plan and independent plan review were completed before the first ticket snapshot was committed.
  - verify: Full verification and audit completed before the done-state evidence was committed in the same snapshot.
phase_anchors:
  - define-behavior: .project/tickets/WEXCKV-add-spike-workflow/spec.md
  - scenario-gate: features/add-spike-workflow.feature
  - plan-implementation: features/add-spike-workflow.feature
  - implement: .project/tickets/WEXCKV-add-spike-workflow/impl-plan.md
  - verify: .project/tickets/WEXCKV-add-spike-workflow/test-definitions.md
  - done: .project/tickets/WEXCKV-add-spike-workflow/verify.md
scope:
  - ship a manual spike action skill for bounded build-only uncertainty
  - integrate the spike checkpoint after BDD scenario validation and before implementation planning
  - ship the workflow consistently for Claude Code, Cursor, and Codex
out_of_scope:
  - add a canonical BDD phase or new hook gates
  - make every unfamiliar feature run a spike
  - merge or promote spike code into production implementation
done_when:
  - a maintainer can invoke spike explicitly and receive a bounded experiment workflow
  - BDD routes eligible technical uncertainty through the checkpoint without changing phase order
  - generated host artifacts and parity tests include the new action skill
created: 2026-08-02T14:48:51.806Z
last_modified: 2026-08-02T17:25:18.000Z
---

# add-spike-workflow

**Goal:** Let maintainers resolve a build-only technical uncertainty with disposable evidence before committing to a production implementation plan.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-02T14:48:51.806Z Started: Created ticket WEXCKV
- 2026-08-02T14:49:00.000Z Intake: User requested the full BDD flow after accepting the bounded, post-scenario-gate spike design; intake gates auto-confirmed for this run.
- 2026-08-02T14:52:00.000Z Phase: intake → define-behavior; scope fixed around a manual, bounded, cross-host spike checkpoint.
- 2026-08-02T14:55:00.000Z Phase: define-behavior → scenario-gate; four rules and eight scenarios cover eligibility, evidence lifecycle, host parity, and BDD placement.
- 2026-08-02T15:05:00.000Z Scenario gate: independent review passed after tightening incomplete-charter, branch-history, real-setup, manual-only, and pre-validation boundaries.
- 2026-08-02T15:06:00.000Z Phase: scenario-gate → plan-implementation; load-bearing slice is real setup parity across all three hosts.
- 2026-08-02T15:15:00.000Z Plan gate: independent review passed after splitting project-scoped setup from profile-scoped Codex generation and making every proof boundary explicit.
- 2026-08-02T15:16:00.000Z Phase: plan-implementation → implement; twelve scenario loops planned, no ADR emitted.
- 2026-08-02T15:45:00.000Z Implementation discovery: Codex generation intentionally omits Claude-only manual metadata; returned to scenario-gate to specify the soft explicit-invocation contract honestly.
- 2026-08-02T15:50:00.000Z Scenario and plan re-review passed: Codex parity is now an explicit soft guidance contract, not a hard auto-selection claim; implementation resumed.
- 2026-08-02T16:00:00.000Z Whole-ticket quality review returned implementation to scenario-gate: plan creation must consume a structured handoff, and dirty validated state must not become PRE_SPIKE_BASE.
- 2026-08-02T16:08:00.000Z Lifecycle scenario and plan re-review passed: explicit handoff mapping, dirty-state rejection, and exact committed-base proof added; implementation resumed.
- 2026-08-02T16:20:00.000Z Whole-ticket re-review passed the implementation and both lifecycle fixes; reconciled the plan's evidence/base decisions and closed cross-scenario refactoring with no additional abstraction.
- 2026-08-02T16:25:39.000Z Phase: implement → done with an explicit verify provenance skip; verify and diff-scoped audit passed before this evidence snapshot with 6,120 tests, 713 acceptance scenarios, all 46 ledger entries complete, and no evidence limits.
- 2026-08-02T16:38:00.000Z Quality review reopened the ticket at scenario-gate: production planning must be committed and reviewed in the fresh production worktree before coding, and branch phase provenance must be repaired before repush.
- 2026-08-02T16:48:00.000Z Quality fixes: added real-Git coverage for the complete spike → committed plan → production evidence chain and removed blanket tool preapproval so proof commands retain normal host permissions.
- 2026-08-02T17:23:16.000Z Phase: scenario-gate → plan-implementation after the fresh quality review approved all 30 scenarios and the complete production evidence chain.
- 2026-08-02T17:24:18.000Z Phase: plan-implementation → implement after reconciling the reviewed plan with the quality fixes and the complete refactor ledger.
- 2026-08-02T17:25:18.000Z Phase: implement → verify after every quality and refactor finding was resolved; final verification began from a clean worktree.
