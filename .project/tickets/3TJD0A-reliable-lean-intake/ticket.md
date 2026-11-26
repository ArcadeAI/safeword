---
id: 3TJD0A
slug: reliable-lean-intake
type: epic
phase: done
status: done
scope:
  - Evaluate handbook reductions, including downstream routing, stale-plan consent and architecture decisions.
  - Five intake evaluations on Claude and Codex.
out_of_scope:
  - Full feature implementation outside the focused routing and code-quality checks.
done_when:
  - Each candidate has a recorded two-host decision and selected changes pass combined verification.
product_plan_contract: v1
children:
  - JPT08W
  - 2M8A2C
  - XACF52
  - 4BAM6A
  - WCXR0P
  - QJ3EK7
created: 2026-11-26T07:08:24.535Z
last_modified: 2026-11-26T15:20:27Z
---

# Get reliable feature plans with shorter instructions for Claude and Codex

**Goal:** Validate decision ownership, fresh-feature intake, and three isolated prompt reductions on both hosts.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-26T07:08:24.535Z Started: Created ticket 3TJD0A

## Evaluation plan

For the original five intake evaluations, baseline is product revision `904e78010`. Pin both hosts to the same comparison snapshot. Keep each candidate isolated.

1. Replay the café reviewer pair three times per host with a single sentence about the source of product choices. Require at least two paired successes out of three per host. Measure exact findings, approvals and spend.
2. Run a new equipment-loan feature on both hosts. Test disclosure of an existing-loan conflict and preservation of the supplied unmatched-return rule. Each trial needs a correct plan and independent approval before any scenario or code. Charge author and reviewer against the shared $3 cap. Route new product decisions to the operator.
3. Remove the repeated Product Plan walkthrough from the handbook.
4. Remove the duplicate phase-to-file table from the BDD skill.
5. Condense duplicated checkpoints, project-context instructions and template examples in the intake guide. Preserve child and exceptional paths.

Compare each deletion to baseline on the same inputs, verify both host bundles, and replay the accepted combination on both hosts before adoption. Record failures and incomplete evidence separately. Jobs use new workspaces and local account credentials. Keep raw logs private.

## Results

[Scorecard, evidence and decisions](./scorecard.md)

All five evaluations have recorded decisions. The 65-line reduction passed six trials on both hosts across three features. Keep the original reviewer wording. Raw evidence showed no draft PRs requiring cleanup.

Follow-up: [Handbook reductions and behavioral checks](../QJ3EK7-lean-session-guidance/ticket.md).

All 78 planned trials have scored outcomes. The approved shift plan allows back-to-back assignments and rejects positive-duration overlap for the same employee.
