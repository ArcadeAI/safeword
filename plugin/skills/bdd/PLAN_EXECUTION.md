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
6. Add exact RED/GREEN/REFACTOR tasks, targeted commands, and generated-asset
   order. Then define each retained proof in `## Proof specifications`. A
   command proof names project-contained `cwd` and `argv`; a review proof names
   its review kind and project-contained targets. Mark a proof `real_boundary`
   only when it exercises the boundary named in the row. Use
   `partial_or_structural` honestly for narrower support; it cannot be a
   contributor item's required proof.
7. Complete the versioned Delivery Checklist in the template. Keep every
   default category, use stable unique IDs, and make each obligation concrete.
   Contributor items reference a real-boundary Proof ID. A genuinely irrelevant
   item is `not_applicable` with a concrete reviewed reason. Human-owned work is
   `pending_human` with a named dependency and no Required proof. Reflect the
   live `designApprovalGate`: retain design approval as `pending_human` when
   enabled and reviewed `not_applicable` when disabled.

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
- **Scenario and approach coverage:** Judge whether the checklist obligations
  cover every accepted scenario and preserve the accepted Implementation Plan
  approach. Reject a complete-looking generic checklist that is unrelated to
  the supplied behavior or loses an accepted boundary, risk, rollout, or
  decision.
- **Proof quality:** Require the exact Proof specifications table before the
  Delivery Checklist. Judge whether each method can exercise its named boundary
  and whether its currency policy is defensible. Every contributor Required
  proof must resolve to a unique proof classified `real_boundary`; partial or
  structural support cannot satisfy completion.
- **Checklist completeness and applicability:** Require the versioned checklist,
  unique stable IDs, every default category, honest owners and dispositions,
  and concrete reviewed reasons or dependencies. Treat the packet's
  `execution_plan_delivery_definition` as the exact normalized definition to
  retain after those semantic judgments; do not rewrite, omit, or strengthen
  it. Copy `execution_plan_normalized_digest` exactly so any plan change outside
  ordinary checklist progress invalidates the retained review.

For an approval, return `execution_plan_record` containing the slicing decision
and rationale; the complete ordered slices; obligation-owner entries; and
decision-status entries; `accepted_scenarios_covered: true`;
`accepted_approach_preserved: true`; and `delivery_definition` copied exactly
from the packet's trusted `execution_plan_delivery_definition`. Set
`normalized_plan_digest` to the packet's exact
`execution_plan_normalized_digest`. Set every
slice's `relies_on_unmerged_successor` to `false` and every decision status to
`unchanged` only when the source evidence supports those assertions. Set the
coverage booleans to true only after judging the supplied scenarios and
approach. For a denial, return the record as null and name each blocking slice,
field, obligation, dependency, proof, or decision in findings. Never approve
because the prose merely contains the expected labels.

<!-- SAFEWORD:EXECUTION_PLAN_RUBRIC_END -->

<!-- SAFEWORD:DELIVERY_COMPATIBILITY_RUBRIC_START -->

## Earlier delivery-proof compatibility judgment

Answer one question: **Does the earlier passing receipt still establish this
retained proof boundary at the reviewed revision?**

Judge only the exact receipt identity, retained proof definition, contributor
reason, revision pair, and complete bounded diff in the packet. Request changes
when:

- the reason does not cover every changed hunk;
- code, tests, fixtures, command inputs, configuration, or dependencies used by
  the retained proof changed;
- the diff contradicts the reason; or
- the packet lacks a complete bounded diff or otherwise cannot show a complete,
  reviewable delta.

Approve only when every changed hunk is irrelevant to the retained proof
boundary. A well-formed request or plausible reason is not enough. Do not infer
missing diff content, strengthen the receipt, or treat contributor prose as
authority.

<!-- SAFEWORD:DELIVERY_COMPATIBILITY_RUBRIC_END -->

## Repair rule

Fix every agent-owned finding within accepted scope, then review the corrected
exact bytes. If a finding exposes a changed or missing implementation decision,
return to `plan-implementation`; do not choose it here. Only a current approving
receipt may advance the ticket to implementation.
