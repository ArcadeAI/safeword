# Execution Planning

**Entry:** the Implementation Plan is approved and the ticket is at
`plan-execution`. Behavior and implementation decisions are fixed. This phase
turns them into startable work; it does not redesign them or edit application
code.

Scaffold `execution-plan.md` next to `ticket.md` from
`"${CLAUDE_PLUGIN_ROOT}"/resources/templates/execution-plan-template.md`.

## Author the plan

1. Read the approved scenarios, Implementation Plan, and applicable project
   guides. Extract every accepted behavior, migration, rollout, rollback,
   documentation, and affected-surface obligation. Do not invent missing
   decisions; return a genuine gap to Implementation Planning.
2. Decide explicitly whether delivery is one pull request or multiple pull
   requests. Explain the boundary in terms of conceptual scope and independent
   proof, never line or file count alone.
3. Put slices in dependency order. Each slice has one coherent purpose, a clear
   boundary, every prerequisite, its own proof, a concrete completion signal,
   and an explicit statement that it does not rely on an unmerged successor.
   Every merge must leave the repository in a safe supported state.
4. Map every accepted obligation to one or more slices. Separately list work
   delegated to another ticket so it cannot be mistaken for local ownership.
5. Account for every Recorded Decision in `impl-plan.md` as `unchanged`. If a
   decision changed or a new decision is needed, return to Implementation
   Planning, update and review that plan, then resume here.
6. Add exact RED/GREEN/REFACTOR tasks, targeted commands, generated-asset order,
   and the contribution delivery checklist: tests, monitoring, migration,
   documentation, rollout, rollback, and ownership. Use `skip: <reason>` only
   when a checklist concern is genuinely inapplicable.

## Shared author/reviewer contract

The text between the markers is the one semantic contract used by authors and
reviewers. The packaged reviewer rubric is generated from these exact bytes.

<!-- SAFEWORD:EXECUTION_PLAN_RUBRIC_START -->

Review the Execution Plan against the exact approved scenarios and
Implementation Plan supplied in the bounded packet. Do not substitute a
reviewer-created baseline, reopen an accepted decision, or infer an obligation
from outside those sources.

- **Slicing decision:** Require an explicit `one_pull_request` or
  `multiple_pull_requests` decision and a nonblank rationale grounded in
  conceptual cohesion and independent proof. One pull request has exactly one
  slice; multiple pull requests have at least two. Reject line or file count as
  the sole justification.
- **Complete slices:** Require one record per plan slice, in plan order. Every
  slice has a unique nonblank name, one coherent purpose, a clear boundary, a
  present prerequisite list, its own proof obligation, a concrete completion
  signal, and a readable `relies_on_unmerged_successor` assertion. Reject a
  slice with two independently valuable purposes or any implementation choice
  the approved plan did not settle.
- **Dependency safety:** Require every prerequisite to name a unique earlier
  slice. Reject cycles, forward dependencies, missing prerequisites, and any
  slice that becomes safe only after a later merge. Every intermediate merge
  must leave the repository in a supported state.
- **Conceptual reviewability:** Judge boundaries by whether one concern can be
  understood and proven independently. Many mechanical edits with one outcome
  may be one slice; a few edits with two independently valuable outcomes may
  require two. Numeric size signals may prompt inspection but never decide it.
- **Obligation and decision preservation:** Require at least one obligation-owner
  entry and cover every accepted behavior, migration, rollout, rollback,
  documentation, and affected-surface obligation with existing slice names.
  Require at least one decision-status entry and account for every Recorded
  Decision, or the explicit no-load-bearing-choice applicability decision, with
  the readable status `unchanged`. Reject an omitted obligation, an unowned
  slice, or any reopened decision.

For an approval, return `execution_plan_record` containing the slicing decision
and rationale; the complete ordered slices; obligation-owner entries; and
decision-status entries. Set every slice's `relies_on_unmerged_successor` to
`false` and every decision status to `unchanged` only when the source evidence
supports those assertions. For a denial, return the record as null and name
each blocking slice, field, obligation, dependency, or decision in findings.
Never approve because the prose merely contains the expected labels.

<!-- SAFEWORD:EXECUTION_PLAN_RUBRIC_END -->

## Repair rule

Fix every agent-owned finding within accepted scope, then review the corrected
exact bytes. If a finding exposes a changed or missing implementation decision,
return to `plan-implementation`; do not choose it here. Only a current approving
receipt may advance the ticket to implementation.
