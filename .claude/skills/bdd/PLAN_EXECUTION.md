# Execution Planning

**Entry:** the Implementation Plan is approved and the ticket is at
`plan-execution`. Behavior and implementation decisions are fixed. This phase
turns them into startable work; it does not redesign them or edit application
code.

Scaffold `execution-plan.md` next to `ticket.md` from
`.safeword/templates/execution-plan-template.md`.

## Author the plan

1. Read the approved scenarios, Implementation Plan, and applicable project
   guides. Load the installed testing guide while turning each accepted proof
   strategy into startable work. Extract every accepted behavior, decision-derived implementation,
   proof-strategy implementation, migration, rollout, rollback, documentation,
   affected-surface, and measurement-execution obligation. For an accepted
   quantitative contract, preserve its outcome, population, target, origin,
   method, validity safeguards, and failure behavior exactly. Do not invent
   missing decisions; return a genuine gap to Implementation Planning.
2. Decide explicitly whether delivery is one pull request or multiple pull
   requests. Explain the boundary in terms of conceptual scope and independent
   proof, never line or file count alone.
3. Put slices in dependency order. Each slice has one coherent purpose, a clear
   boundary, every prerequisite, its own proof, a concrete completion signal,
   and an explicit statement that it does not rely on an unmerged successor.
   Every merge must leave the repository in a safe supported state.
4. Map every accepted obligation to one or more local slices; an accepted
   obligation cannot be discharged by naming another ticket. Separately list
   only excluded or later work, with its other ticket, under Deferred scope
   ownership so it cannot be mistaken for accepted local scope.
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
   live `designApprovalGate` in the plan's approval context, not as an invented
   Delivery Checklist disposition. The `approve-plan` transition has already
   settled this gate before Execution Planning begins; pending authority
   cannot enter this phase.

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
- **Startable steps:** Every executable step must name its exact action, inputs,
  prerequisites, and observable expected result. Require the first production
  slice to begin with the highest-risk named RED and state its command or fixture
  plus the failure signal before any production edit. Reject any step that leaves
  behavior, architecture, data, proof, or ordering for the implementer to invent.
  <span>A test step must name its fixture, command, edit action, expected exit or assertion, and real actor boundary.</span>
- **Dependency safety:** Require every prerequisite to name a unique earlier
  slice. Reject cycles, forward dependencies, missing prerequisites, and any
  slice that becomes safe only after a later merge. Every intermediate merge
  must leave the repository in a supported state.
- **Conceptual reviewability:** Judge boundaries by whether one concern can be
  understood and proven independently. Many mechanical edits with one outcome
  may be one slice; a few edits with two independently valuable outcomes may
  require two. Numeric size signals may prompt inspection but never decide it.
- **Obligation and decision preservation:** Require at least one accepted
  behavior obligation and owner. Cover every applicable accepted behavior,
  decision-derived implementation, proof-strategy implementation, migration,
  rollout, rollback, documentation, and affected-surface obligation with
  existing slice names, dependency order, and a completion signal. Optional
  categories explicitly recorded as inapplicable by the accepted Implementation
  Plan do not require placeholder owners or tasks; never treat that as permission
  to omit the feature's accepted behavior. Require at least one decision-status
  entry and account for every Recorded Decision, or the explicit
  no-load-bearing-choice applicability decision, with the readable status
  `unchanged`. Reject an omitted or partially mapped applicable obligation, an
  unowned slice, or any reopened decision.
- **Measurement execution:** When the accepted plans define a quantitative
  contract, require owned, dependency-ordered instrumentation, tests, evidence
  collection, and a concrete completion signal. Preserve the accepted outcome,
  population, target, measurement origin, method, validity safeguards, and
  failure behavior exactly. Missing execution mechanics return to
  `plan-execution`; changing any accepted measurement term returns to
  `plan-implementation`, even when restoring the accepted value would be easy.
- **Discovery routing:** Classify every requested change by what it alters. A
  fixture implementation, test command, file location, sequencing detail, or
  other execution mechanic remains in `plan-execution` when all accepted
  behavior, design, API, data, and proof boundaries remain unchanged. Any
  changed or newly required accepted decision—including a design, API, data,
  behavior, or proof boundary—returns to `plan-implementation`. Classify the
  semantic change, not its filename: a path-only edit stays, while a path edit
  that also changes the accepted API contract returns. An inadequate command,
  fixture, or proof method stays in `plan-execution` when the accepted proof
  boundary itself remains unchanged; only changing that accepted boundary
  returns to `plan-implementation`.
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
- **Current-to-target truthfulness:** Require every obligation to distinguish
  current implementation from target work. Absent implementation is target work
  with missing proof. Only matching implementation with current-revision,
  real-boundary proof may be recorded as implemented and proven. Reusable
  earlier-revision proof remains open for current proof. Keep a known defect
  separate from its target correction, and completed contributor work separate
  from pending human authority. Never call stale proof, a known defect, or
  pending human authority complete.
- **Checklist completeness and applicability:** Require the versioned checklist,
  unique stable IDs, every default category, honest owners and dispositions,
  and concrete reviewed reasons or dependencies. Treat the packet's
  `execution_plan_delivery_definition` as the exact normalized definition to
  retain after those semantic judgments; do not rewrite, omit, or strengthen
  it. Copy `execution_plan_normalized_digest` exactly so any plan change outside
  ordinary checklist progress invalidates the retained review.

Always return `planning_destination`. Set it to `plan-execution` for approvals
and for denials that only require Execution Plan repair. Set it to
`plan-implementation` when a denial exposes a missing or changed accepted
decision or proof boundary. For an approval, return `execution_plan_record`
containing the slicing decision
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

## Exit: review before implementation

Resolve the current scenarios, approved `impl-plan.md`, ticket scope, and
`execution-plan.md`. Run `bun .safeword/hooks/resolve-project-knowledge.ts`
and use its configured paths for principles, personas, surfaces, and any
dimensions; do not guess missing paths. Dispatch the shared coordinator with the Execution Plan as
the sole work target and the accepted plans and scenarios as bounded context:

```bash
bun .safeword/hooks/run-review.ts review run plan-execution --agent-handoff --json --context ticket-path/spec.md ticket-path/ticket.md feature-file ticket-path/impl-plan.md principles-file personas-file surfaces-file dimensions-file-if-present testing-guide-file applicable-guide-files execution-plan-template-file -- ticket-path/execution-plan.md
```

**The dispatch is authorized; skipping it is not your call.** The configured
coordinator enforces `crossAgentReview` before provider dispatch, so do not
stop and ask for consent in chat. Never pass credentials, customer data, or
secret-bearing files as targets or `--context`; omit or redact them, or report
the bounded packet as blocked. Invoke the coordinator first. A review you never
dispatched is not coverage.

The coordinator's typed verdict and achieved independence are authoritative.
Keep a `REVIEW_PENDING` review id and collect its returned status action; do not
redispatch unchanged sources. Repair agent-owned findings at the destination
named by `planning_destination`, then review the corrected exact bytes. Apply
the shared review-route recovery rule in `PLAN_IMPLEMENTATION.md` for
authentication and exhausted routes. `architectureReviewGate` applies to
Implementation Planning's architecture requirement, not this Execution Plan
review. A degraded result may advance only after
typed route exhaustion and an approving `/finish-review` fallback; record its
actual reduced independence and never call it independent coverage. An
undispatched or otherwise degraded review cannot advance.
After approval, stamp the exact review with its returned provenance:

```bash
bun .safeword/hooks/write-review-stamp.ts --author-agent "author-agent" --reviewer-agent "actual-reviewer" --independence "independence" --review-id "review_id" --phase plan-execution
```

Run `safeword ticket coding-authorization <ticket-id>` before updating the
tracked ticket phase to `implement`. Unlike `approve-plan`, this is a
read-only authorization check followed by a ticket phase edit; the phase gate
enforces the current review and proof prerequisites on that edit. Never enter
TDD on an unstamped or stale plan.
