---
id: BR373S
slug: protect-remote-test-runners
type: feature
phase: verify
status: in_progress
phase_anchors:
  - define-behavior: .project/tickets/BR373S-protect-remote-test-runners/spec.md
  - scenario-gate: packages/cli/features/run-requested-revision-remotely.feature
  - plan-implementation: .project/tickets/BR373S-protect-remote-test-runners/impl-plan.md
  - implement: packages/cli/src/test-execution/remote-workflow-contract.ts
  - verify: .project/tickets/BR373S-protect-remote-test-runners/verify.md
scope:
  - Exact requested-commit checkout and reporting
  - Validation of the requested done or full test lane
  - Read-only workflow permissions, immutable action pins, and non-persisted checkout credentials
out_of_scope:
  - CLI preference, installation reconciliation, and dispatch transport
  - Defending customers from their own code, maintainers, workflows, or secrets
  - Branch-tip revalidation, workflow self-authentication, custom cryptography, and pre-check APIs
done_when:
  - The job checks out and reports the exact full commit SHA requested by Safeword
  - Only the requested done or full lane reaches checkout and execution
  - Workflow permissions are exactly contents read, actions are pinned, checkout credentials are not persisted, and Safeword supplies no secret
parent: BBNZ68
created: 2026-08-09T21:20:39.486Z
last_modified: 2026-08-18T07:17:53-07:00
---

# Run the requested revision remotely with least privilege

**Goal:** Run the requested immutable revision in the customer's GitHub Actions environment with only the authority ordinary tests need.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-09T21:20:39.486Z Started: Created ticket BR373S
- 2026-08-09T21:20:59Z Scoped: Owns the remote workflow security boundary required by dispatch and result evidence.
- 2026-08-17T00:00:00-07:00 Intake reframed: assume customer code and its GitHub environment are non-malicious; retain only exact-revision correctness and least privilege. Awaiting confirmation of the narrowed job before rewriting Rules and engineering scope.
- 2026-08-17T00:00:00-07:00 Job, GitHub-native inspiration, and three Rules confirmed: exact revision, supported lane, and read-only execution. Proposed the corresponding minimal engineering contract and removed the obsolete dependency on the workflow-lifecycle epic.
- 2026-08-17T00:00:00-07:00 Engineering scope confirmed. Advanced to behavior definition with the non-malicious customer-code assumption explicit and adversarial runner machinery excluded.
- 2026-08-17T00:00:00-07:00 Behavior set confirmed: six representative scenarios cover exact SHA success/rejection, both supported lanes/unsupported rejection, and minimum/broader workflow authority. Advanced to scenario quality review.
- 2026-08-17T00:00:00-07:00 Scenario gate approved by an independent cross-agent Claude review after tightening false-green rejection, exact revision boundaries, lane selection, and the symmetric minimum-authority contract. No build-only kill risk remains; advanced to implementation planning.
- 2026-08-17T00:00:00-07:00 Plan review requested two corrections: prove unavailable checkout without a false-green structural assertion, and distinguish rejected requests from completed test results. Revised the plan around a checkout boundary recorder and explicit rejected/passed/failed summaries; removed the unnecessary requirement that a workflow contain a remote runtime dependency.
- 2026-08-17T00:00:00-07:00 A second plan review found the exact-revision proof could echo its own requested input. Corrected it to read and compare `git rev-parse HEAD` in a real temporary Git workspace, including a divergent-HEAD fail-closed case; clarified the harness boundary, protocol-version choice, and zero-secret rule.
- 2026-08-17T00:00:00-07:00 A third plan review found checkout `ref:` and input-expression wiring were not yet statically pinned. Extended the small semantic contract to require exact input/env/ref bindings and effective job permissions, made divergent HEAD explicitly rejected, and required non-tip SHAs in release admission runs.
- 2026-08-17T00:00:00-07:00 A fourth plan review found inline workflow expressions could make the local harness rewrite rather than execute real shell. Required all context through exact step `env:` bindings and forbade expressions in `run:`; added an explicit runner-error state and four focused live admission cases. Confirmed `safeword@0.78.3` is already published, removing the alleged publish/admission loop.
- 2026-08-17T00:00:00-07:00 A fifth plan review exposed two final contracts: checkout workspace depth and the machine-readable result channel. Fixed checkout at one commit, replaced prose/extra error state with one closed JSON artifact (`rejected | passed | failed`), made workflow inputs required without defaults, and kept infrastructure failure as absence of a Safeword result.
- 2026-08-17T00:00:00-07:00 A sixth plan review found failed jobs could skip artifact upload and permissive step controls could bypass rejection. Required `always()` on report/upload, prohibited every other condition and `continue-on-error`, fixed the trigger, simplified JSON to one status plus a closed rejection-reason enum, and made the local non-tip shallow fixture match checkout.
- 2026-08-17T00:00:00-07:00 A seventh plan review found cancellation had no honest result state. Added only `incomplete`, specified a buildable shallow non-tip fixture and validation-reason recomputation, and assigned the artifact schema to BR373S with S2TF4J as its consumer.
- 2026-08-17T00:00:00-07:00 Implementation plan approved by independent cross-agent Claude/Opus review. Recorded the plan stamp and advanced into outside-in TDD.
- 2026-08-17T22:33:00-07:00 Reconciled implementation with the approved plan after independent quality review. The workflow and evaluator match the three Rules; release admission remains with GRDXXA, and adversarial customer-code isolation remains explicitly out of scope. Advanced to verification.
- 2026-08-17T23:01:40-07:00 Verification recorded: focused BR373S tests, acceptance scenarios, actionlint, build, lint, and ticket-scoped audit checks pass. Completion remains blocked by the umbrella branch's broader PR scope, 10 repository-wide Vitest failures, unfinished repository-wide BDD features, and 11 principle-trace errors in sibling active tickets.
- 2026-08-18T07:17:53-07:00 Isolated BR373S onto current main in its own branch/worktree. Fixed the acceptance harness to resolve the workflow template from its module rather than the caller's working directory. Focused tests, full tests, full acceptance, builds, lint, typecheck, actionlint, audit, and PR scope are green.
