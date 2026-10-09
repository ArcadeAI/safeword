---
id: D1BKYA
slug: let-approved-planning-reviews-advance-honestly
type: task
phase: implement
status: in_progress
subtype: bug-investigated
scope: Repair the redundant planning-approval prerequisite and misleading rejection rendering diagnosed in 5F5ZZA PR 1.
out_of_scope: Contract generation, semantic context identity, fallback routing, reviewer rubrics, migration, and new approval authority.
done_when: Real CLI tests distinguish approved warnings, rejection findings, missing receipts, and stale receipts; relevant verification and independent review pass.
created: 2026-09-26T02:55:10.402Z
last_modified: 2026-09-26T02:55:10.402Z
---

# Let approved planning reviews advance honestly

**Goal:** Honor one authenticated current planning approval and report only real review rejection findings.

**Why:** 5F5ZZA PR 1 diagnoses a redundant stamp prerequisite and approved warnings rendered as rejection reasons.

## Work Log

- 2026-09-26T02:55:10.402Z Started: Created ticket D1BKYA

## Approved scope

This implements only PR 1 of [5F5ZZA's Execution Plan](../5F5ZZA-keep-plan-reviews-current-and-trustworthy/execution-plan.md) under epic #4200. The existing phase-admission service remains the single authenticated review authority. Structural Implementation Plan validation stays in its existing gate.

## Root cause

`currentReview` in `packages/cli/src/commands/plan-approval.ts` requires both an artifact self-stamp and authenticated phase admission. A current phase approval can therefore be rejected solely for lacking the redundant artifact stamp. `latestReviewRejection` renders any matching review's findings without checking `status === 'changes_requested'`, turning approved warnings into apparent rejection reasons.

The approved plan records the exact reproduction: a coordinator approval with warnings and a phase stamp failed; adding the weaker artifact stamp let it advance. Current source confirms both mechanisms. Missing authentication and stale plan bytes are distinct valid refusals, not reasons to preserve the duplicate authority path.

## Verification plan

First reproduce the failure through `ticket approve-plan` with the real CLI and coordinator, mocking only the reviewer process. Prove a current approved review with warnings advances without the extra artifact stamp, an actual rejection reports its findings, and missing or stale evidence reports its admission failure rather than approved findings. Then remove the duplicate check, keep current authentication/digest enforcement, and update the canonical review/stamp/approve guidance without adding another receipt path.

Targeted checks: `plan-design-approval.test.ts`, `plan-transition-gate.test.ts`, and `review-receipt-wiring.test.ts`. Before delivery: relevant lint/typecheck, full package verification, generated-host parity if guidance changes, and independent review. No completion or Ready claim is made before those results are collected.

- Resume: Confirmed the approved PR 1 scope and existing real CLI harness. Begin RED for a warning-bearing approval with only the authenticated phase stamp.

- Implementation: RED d17892b68; authenticated phase approval GREEN 14878b34a;
  truthful rejection GREEN 5622a89b8. Both executable RED proofs earned independent
  coordinator approval. The five-file focused verification passed all 123 tests.
- Final review: current-source Claude review 8ef57710-b37d-4576-882b-730003b2085f
  approved with no error findings. Warnings and remaining verification are recorded
  in verify.md; completion is not yet claimed.
- User-requested toolchain repair: repository launcher and Git hook now resolve
  pinned Bun/Node for child processes. The personal shell-profile workaround was
  reverted. This explicit additional scope does not change planning authority.

- Scoped delivery continuation: this checkout contains only D1BKYA and its
  required generated guidance, lifecycle fingerprints and acceptance counts,
  stacked on the separately scoped repository-toolchain branch. Review IDs and
  RED/GREEN commit IDs above describe the original continuation checkout; no
  authenticated receipt or review key was copied here. Fresh local verification
  and independent review are required before any delivery completion claim.

- Current-main integration, 2026-10-07: merged the repository-toolchain slice
  `42c6d2ea88c88f2ffc029c321ea4f0c97e489dae`, which carries main `485d8ac`.
  Frozen installation, typecheck, and all five regenerated surfaces passed.
  Four complete targeted files report **139 passed, one failed** (140 total).
  The failure is the preserved legacy execution-discovery regression: a second
  `approve-plan` reuses the old Implementation approval without repair (expected
  exit 2, actual exit 0). No test was filtered or weakened. Logs:
  `/tmp/4200-D1-main-targeted.log`, `/tmp/4200-D1-main-typecheck.log`, and
  `/tmp/4200-D1-main-generated.log`. The pending diagnostic test and its existing
  `verify.md` investigation remain unstaged and byte-identical to their saved
  pre-merge snapshots. The merge does not claim this defect fixed, acceptance
  complete, a Ready promotion, or human merge approval.

- Fresh bounded Claude review `33c980be-06fa-4835-848a-18f44dc1f089`
  approved the D1 material diff with no error findings. This does not overturn
  the actual failing diagnostic. Its suggested specific-denial assertion and
  formatting apply to that unstaged RED investigation, not a passing delivery
  test; they remain pending scoped repair rather than silently modifying tests.
  The mirrored guidance is regenerated and its complete document-contract file
  passed in the 139-test result. A rejection from earlier plan bytes can still
  be rendered as the reason for refusing unreviewed current bytes; admission
  remains closed, and no claim that this informational limitation is fixed is
  made. Log: `/tmp/4200-D1-main-quality.json`.

- Concurrent approval scaffold repair: Node 22 CI on acceptance head
  `65f7963af` reported one failed CLI invocation. A deterministic installed-CLI
  regression reproduced exits `[1, 0]` when both approvals observed the absent
  Execution Plan before exclusive creation. The repair handles only `EEXIST`
  from the losing create; all other errors still throw. The new regression
  passes with the repair, and both concurrency cases pass in D1 (2 passed,
  35 filtered by the explicit targeted selector). Logs:
  `/tmp/4200-scaffold-permanent-red.log`,
  `/tmp/4200-scaffold-permanent-green.log`, and
  `/tmp/4200-scaffold-D1-permanent-green.log`. Source review
  `441e7626-977b-424b-9970-3794e263b2c0` approved the narrow repair; the new
  regression addresses its warning about chance-based scheduling. The separate
  legacy approval-reuse RED and its verification investigation remain unstaged
  and unresolved. This repair does not reclassify earlier failed CI as passing.
