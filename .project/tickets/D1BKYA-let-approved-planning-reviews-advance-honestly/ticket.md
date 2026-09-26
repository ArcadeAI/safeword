---
id: D1BKYA
slug: let-approved-planning-reviews-advance-honestly
type: task
phase: intake
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
