---
id: 7CAMAD
slug: turn-decisions-into-startable-work
type: feature
phase: implement
status: in_progress
phase_skips:
  - 'intake: originally inherited the 2026-09-08 approval of 82T411; that approval became stale after material parent changes and was superseded by the fresh Product Plan approval recorded on 2026-09-09T23:46:25.000Z'
  - "define-behavior: partitioned the accepted 82T411 Rule and scenario packet at Safeword's documented split restart point"
phase_anchors:
  - scenario-gate: features/turn-decisions-into-startable-work.feature
  - plan-implementation: features/turn-decisions-into-startable-work.feature
  - plan-execution: .project/tickets/7CAMAD-turn-decisions-into-startable-work/impl-plan.md
  - implement: .project/tickets/7CAMAD-turn-decisions-into-startable-work/impl-plan.md
scope:
  - turn a reviewed current Implementation Plan into dependency-ordered build and test work
  - own the integrated demo continuation: turn the complete and correct accepted Implementation Plan into an Execution Plan, then begin the first RED step without inventing a decision
  - map every accepted behavior, decision, proof, migration, rollout, rollback, and surface obligation to startable steps
  - return discoveries only when they alter an accepted decision or proof boundary
  - distinguish current implementation, target work, evidence currency, and pending human authority
  - apply the accepted dependency-direction invalidation matrix when upstream scope, behavior, or either plan changes
  - carry the feature Delivery Checklist and map work into dependency-ordered tasks and independently reviewable pull-request slices
  - turn accepted measurement decisions into concrete instrumentation and evidence collection
  - return implementation-time decisions to the plan they change, re-review every invalidated downstream plan, preserve still-valid work and evidence, and resume from the first affected obligation
out_of_scope:
  - choosing architecture, API, data, authorization, compatibility, rollout, rollback, or proof-scope decisions
  - implementing review transport, provenance, fallback, and work-type classification mechanics
  - claiming completed implementation, passed verification, release approval, or merge authority from Execution Plan approval
done_when:
  - after G1C9PP proves the plan-repair loop, a fresh-context agent turns the complete and correct accepted Implementation Plan into startable work and begins the first RED step without inventing a decision
  - every accepted obligation maps to owned work, dependencies, proof mechanics, and completion evidence
  - decision changes return to Implementation Planning with completed evidence preserved
  - the reviewed plan records current-to-target work, honest proof strength, the Delivery Checklist, and coherent PR slices without overstating approval
  - every accepted measurement decision has startable instrumentation, test, and evidence work without changing the upstream promise
  - a design-changing implementation decision repairs and re-approves both plans before work resumes, while a sequencing-only decision repairs and re-approves only the Execution Plan
product_plan_contract: v1
parent: 82T411
parent_job: plan-implementability.TBU2
milestone: M1
depends_on: [G1C9PP, 5F5ZZA, 6XW8H7, A639WN]
created: 2026-09-08T17:36:33.908Z
last_modified: 2026-09-10T01:57:42.000Z
parent_contract_digest: c107ca39dc842a473be4ea5e12c6d448d12ccccd211da65b92ec3b689c03c8a3
---

# Turn accepted decisions into startable work

**Goal:** Produce an Execution Plan a fresh agent can begin without inventing a contract

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-20T19:43:43.000Z Retained live evidence — R13 slice ownership:
  reused the current Claude Opus admission for `all-obligations-assigned`,
  `one-coherent-change`, `several-ordered-changes`, and
  `missing-rollback-obligation`. Those cases respectively prove complete
  ownership, coherent one-PR work, dependency-ordered multi-PR work, and named
  rejection of an unowned rollback obligation. The admission remains bound to
  contract `f6ed238d92e2b929d6c07b51ffd9b92447f7dba7e7c6875759573adab931f024`
  and corpus `833df049ac3d3cbe119fac7f8ecf43c614e1cf6c4d64b97c4f0781e4ee8f6309`;
  `bun run test tests/review/execution-plan-conformance.test.ts` passed 59/59
  against those current bytes.

- 2026-09-20T19:20:00.000Z Scenario gate: Claude Opus independently approved
  all 37 scenarios with cross-agent provenance (review
  `4ad5ebbf-18af-414e-af70-78e971384606`). No must-fix findings remained. The
  reviewer confirmed that the deterministic matrix substitutes only for the
  repeated semantic verdict while CI still exercises the installed CLI.

- 2026-09-20T19:14:00.000Z Scenario review correction: clarified that the
  deterministic admission matrix substitutes only for the live reviewer's
  semantic verdict. CI still exercises every scenario through the installed
  Safeword CLI, so the matrix cannot replace the accepted actor boundary.

- 2026-09-19T22:35:02.000Z Live evidence — R15 measurement execution matrix:
  the pre-contract Claude Opus run failed 4 of 7 cases, approving plans that
  omitted instrumentation or evidence collection and routing changed validity
  safeguards and failure behavior to Execution Planning. After adding the shared
  measurement-execution contract, the same seven cases passed 7/7: complete work
  was approved; both omissions were denied in Execution Planning; and changes to
  the accepted target, origin, validity safeguards, or failure behavior returned
  to Implementation Planning. The retained admission artifact combines those
  seven results with the prior 51/51 matrix, and the deterministic review suite
  passed 111/111. GREEN is commit `3c65b65f5`; RED is the committed seven-case
  corpus at `6310e9ce2` plus the failing live run.

- 2026-09-19T21:26:06.000Z Live evidence — R10 obligation mapping matrix:
  ran the current 51-case Execution Plan corpus through the real Claude Opus
  reviewer. Fifty cases completed in the full run; the sole timed-out
  `all-decisions-unchanged` case passed when retried with identical plan and
  contract bytes, yielding 51/51 unique semantic verdicts. Regenerated the
  content-bound admission artifact from those passing records. The deterministic
  conformance suite then passed 54/54. GREEN is commit `45bcf2227`; RED is the
  live matrix and its committed corpus/contract identity.

- 2026-09-19T18:05:00.000Z Returned to scenario gate — obligation-floor
  correction: executable-RED review exposed a contradiction between R10's
  zero-obligation example and 6XW8H7's accepted contract that every in-scope
  feature retains at least one accepted behavior obligation and owner. Kept
  that behavior floor and narrowed the example to optional migration, rollout,
  rollback, documentation, and affected-surface categories that the accepted
  approach explicitly marks inapplicable. Rejected a `no_pull_request` mode
  because it would expand the approved schema and could authorize delivery
  planning with no executable work; rejected denying all inapplicability
  because that would manufacture placeholder tasks. Existing evidence remains
  audit history, but both plans require fresh review after this scenario repair.

- 2026-09-19T17:24:52.000Z Root cause — installed proof-step journey:
  the canonical concrete-proof sentence was present in the generated reviewer
  rubric and bundled runtime, but a Markdown line break split the exact contract
  signal expected by the installed-CLI reviewer fixture. The fixture therefore
  followed its legacy approval path for both incomplete plans. Confirmed by
  comparing `reviewPromptContract('plan-execution')` with the exact signal.
  Ruled out stale generation because the bundled runtime contained the new
  clause and current digest; ruled out wrong routing because the review reached
  the admitted Claude/Opus plan-execution route. Keep this load-bearing contract
  sentence contiguous, regenerate its rubric and admission, and rerun the same
  installed boundary.

- 2026-09-19T13:41:10.000Z Live evidence — data-decision specificity:
  ran the vague, invented, and accepted data-decision partitions through the
  real Claude Opus reviewer. A vague reference to an already accepted store
  and owner was denied for Execution Plan repair; a concrete store and owner
  invented downstream was denied and returned to Implementation Planning; the
  exact accepted `delivery.db` and `DeliveryStateService` decision was
  approved. The supplemental path-only discovery control also passed and
  stayed in Execution Planning. Regenerated the complete 43-case admission
  matrix; 46/46 deterministic conformance tests pass.

- 2026-09-19T12:52:03.000Z Live evidence — discovery routing: ran the
  complete 39-case Execution Plan conformance matrix through the real Claude
  Opus reviewer. Both fixture and test-command repairs stayed in Execution
  Planning; accepted design, proof-boundary, and API-contract changes returned
  to Implementation Planning. Regenerated the admitted rubric from three
  disjoint passing result sets. The installed CLI separately proved that the
  typed return becomes the exact recovery command and an actual ticket phase
  transition. Affected automated suites passed 369 tests with two intentional
  skips.

- 2026-09-19T10:14:00.000Z Live evidence — first-step ordering:
  ran all four ordering partitions through the real Claude Opus reviewer. The
  incomplete prerequisite and no-executable-step plans were rejected; after
  correcting proof-purpose alignment and separating the parallel consumers,
  both risk-first plans were approved. The complete 34-case admission matrix
  regenerated, and 43/43 deterministic conformance tests pass.

- 2026-09-19T09:38:00.000Z Scope correction — scenario-repair authorization:
  executable-RED review exposed a real host-hook defect, but independent
  scenario review confirmed that installed hook delivery belongs to YCFFNC/M2,
  not this child's M1 CLI contract. Removed the proposed hook scenario, test,
  temporary workaround, and Execution Plan work rather than expanding 7CAMAD;
  refreshed the CLI-only scenario and Execution Plan reviews afterward.

- 2026-09-19T08:43:10.000Z Live evidence — later-step implementability:
  ran the focused `later-step-is-not-startable` semantic-conformance case
  through the real Claude Opus reviewer. It returned `request_changes`, named
  Task 4, and identified the unresolved authorization behavior decision. The
  retained passing matrix regenerated
  `execution-plan-admission.generated.ts`; the installed-CLI journey separately
  proves that this verdict blocks approval and reaches the user. Scenario review
  `8baaa076-c589-49da-bac7-7cf460f2f369` approved the explicit `@live`
  classification with cross-agent provenance.

- 2026-09-19T08:00:00.000Z Cold-start journey correction: The real review-stamp
  helper required a scenario target inside the ticket folder even though the
  execution-prerequisite command directs users to the ticket's declared
  `features/...feature` source. Existing fixtures hid the mismatch with
  hand-written stamps. Bound the stamp claim to that declared project-local
  source instead, so accepted scenarios remain current while the separate TDD
  ledger records RED/GREEN/REFACTOR progress. The installed-CLI journey now
  blocks production before the named RED and allows the identical edit after
  the observed failure is recorded.

- 2026-09-19T03:42:00.000Z Execution-proof correction: Independent RED review
  found the first conformance test exercised only an in-process corpus lookup,
  while the accepted demo requires the installed CLI to review the plan and
  reach its named failing test. Returned to Execution Planning, kept the unit
  corpus check as structural support, and assigned actor-boundary approval to
  the Git-backed installed-CLI journey.

- 2026-09-18T23:55:00.000Z Root cause: The ordinary-progress authorization test used an invalid completed Delivery Checklist row (`current` and `receipt`) instead of the contract's `current_revision_real_boundary` evidence class and `receipt:<id>` locator. The parser therefore denied the malformed plan before identity comparison. Confirmed by parsing both rows directly. Ruled out review-identity normalization because the before/after normalized digests were identical; ruled out the new authorization digest because denial occurred first in Delivery Checklist parsing.

- 2026-09-18T19:36:00.000Z Review-stamp verifier root cause: The published
  rc.5 helper was current, but this checkout's dogfood version pointer selected
  the legacy 0.83.1 receipt reader. That reader recognized the new review ID but
  could not report `plan-execution` status or provenance, so the helper failed
  closed with `status: unknown`. Confirmed by querying the same receipt through
  both versions: 0.83.1 returned null receipt fields while the immutable
  published rc.5 runtime returned the complete current approval. Ruled out a
  stale plan (both current CLIs re-fingerprinted it as current), a corrupt job
  record (integrity validation passed), and a failed Claude review (the receipt
  records cross-agent Opus approval). Selected the immutable published rc.5
  runtime explicitly; no receipt check was skipped or weakened.

- 2026-09-18T17:12:00.000Z Review-stamp root cause: The independently
  approved `plan-execution` receipt was current under the feature source but
  rc.4 reported it stale. The feature source fingerprints the normalized
  Execution Plan contract so ordinary Delivery Checklist progress remains
  valid; the rc.4 bootstrap verifier still fingerprints every raw plan byte.
  Ruled out a missing or corrupt review record (both CLIs authenticated the same
  integrity-signed job), changed review inputs (the source CLI re-fingerprinted
  them as current), and npm propagation (rc.4 was publicly available with the
  expected integrity). A legacy raw-byte receipt was rejected as a workaround
  because its approval would become stale during ordinary checklist progress.

- 2026-09-16T22:30:00.000Z Review integration root cause: The first two
  plan-execution reviewer processes received zero provider tokens because this
  new review kind lacked an installed Codex egress rule; a one-word request
  succeeded immediately outside the restricted sandbox. After egress was
  restored, Claude returned an approving record that Safeword rejected because
  PR 1's sibling-ticket entry conditions were copied into the machine field
  reserved for earlier slices in this plan. Ruled out authentication (`claude
  auth status` was healthy), plan content and output-schema size (a tiny
  quality-review request stalled identically in the sandbox), and model choice
  (both Opus and Sonnet stalled there). Kept sibling contracts as plan-level
  entry conditions and made PR 1's within-plan prerequisites explicitly empty.

- 2026-09-16T20:42:00.000Z Scenario review correction: Declared 5F5ZZA's provenance verdict as an explicit dependency and added the missing negative replan case so evidence invalidated by a changed decision remains audit history but cannot masquerade as current proof.

- 2026-09-16T20:31:00.000Z Parent prerequisite reconciliation: Confirmed the epic's fresh Product Plan approval recorded at 2026-09-09T23:46:25.000Z superseded this child's historical stale-approval blocker; the current parent-contract digest reconciles cleanly, so removed the obsolete `blocked_on` marker while preserving the audit note.

- 2026-09-16T19:36:00.000Z Scenario correction during planning: Independent Implementation Plan review found that R16's formatting-only example contradicted the accepted exact-byte Implementation Plan approval architecture. Figure-it-out rejected a second semantic-Markdown identity system; replaced that example with the already accepted non-staling boundary for ordinary Delivery Checklist progress. The corrected scenario bytes require fresh independent review before planning resumes.

- 2026-09-10T01:57:42.000Z Scenario gate: Claude Opus independently approved the final 34-scenario packet with cross-agent provenance (review `61c07e08-c577-4438-88d6-2e59829567aa`). The authenticated scenario-gate stamp was written through the same cache-busted distribution bundle that produced the review, and the child advanced to Implementation Planning.

- 2026-09-09T23:42:56.000Z Killer Demo addition: User added implementation-time replanning. A decision that changes the accepted approach returns through revised and re-reviewed Implementation and Execution Plans; a sequencing-only decision returns through the Execution Plan; both preserve still-valid evidence and resume from the first invalidated obligation.

- 2026-09-09T23:38:16.000Z Killer Demo correction: G1C9PP now owns completing and correcting an inadequate Implementation Plan; this child owns the continuation from the accepted plan through the Execution Plan to the first RED step without a newly invented decision.

- 2026-09-09T23:10:11.000Z Parent reconciliation: `--accept` updated the current parent-contract digest to `6adb25eca1ec5ca8e510dca085cd14539ff08e37d2085f0190d7891c10c0c2a8` after the 23:04 Product Plan changes.

- 2026-09-09T23:04:09.000Z Dependency and demo correction: The integrated Execution Plan now consumes A639WN's evidence taxonomy, and the demo scenario explicitly requires the cold-start agent's semantic review—not a structural gate—to reject the unresolved decision.

- 2026-09-09T22:57:07.000Z Scope correction: Made the TBU2 invalidation decision matrix explicitly in scope while leaving review transport, provenance, and fallback mechanics with 5F5ZZA.

- 2026-09-09T22:44:47.000Z Scenario impact: R15 measurement mechanics, R16 invalidation ownership, and the complete rejection-then-correction demo require updated scenarios before this child can receive a fresh scenario-gate review.

- 2026-09-09T22:38:07.000Z Digest-ownership correction: Added the parent TBU2 review-invalidation rule directly to this TBU2 child; 5F5ZZA still owns the shared provenance mechanics under TBU4.

- 2026-09-09T22:33:02.000Z Demo correction: Assigned this child the complete inherited cold-start sequence at the Safeword CLI boundary—reject the missing contract, accept the correction, then begin the first RED step without a new behavior-shaping decision.

- 2026-09-09T22:28:06.000Z Dependency correction: The integrated Execution Plan contract now follows the M1 Implementation Plan, PR-slicing, and feature-checklist contracts instead of depending on a checklist child placed in M3.

- 2026-09-09T22:19:12.000Z Review gate correction: Restored Safeword CLI as the M1 real boundary that proves the inherited cold-start demo, and recorded the stale parent approval as an explicit blocker before another approval or implementation transition.

- 2026-09-08T17:36:33.908Z Started: Created ticket 7CAMAD

- 2026-09-08T18:05:00.000Z Define behavior: Bounded this child to executable decomposition and 11 inherited obligations.

- 2026-09-08T18:20:00.000Z Scenario gate: Partitioned 11 inherited Rules into child-owned scenarios and R/G/R ledger entries; independent scenario review remains pending.

- 2026-09-08T18:37:46.090Z Scenario gate: All independent routes were exhausted. Main-thread supplemental review strengthened current-plan states, executable first RED, and full obligation mapping; no independent stamp was written.

- 2026-09-08T21:57:30.000Z Scenario gate: Claude Opus independently approved the 25-scenario packet with cross-agent provenance (review `5a84c4b1-c500-4e72-882b-5a5f67b89068`); recorded the scenario-gate stamp and advanced to Implementation Planning. Non-blocking review warnings remain planning inputs.

- 2026-09-09T16:45:00.000Z Returned to scenario gate: A real plan-tightening exercise clarified that the Execution Plan must own current-to-target state, evidence currency, the Delivery Checklist, and reviewable PR decomposition, and that its approval establishes startable delivery rather than implementation, verification, release approval, or merge authority. Preserved the previously approved scenarios while reopening the expanded contract.

- 2026-09-09T21:49:00.000Z Scenario impact: Added the Execution-owned side of quantitative contracts—concrete instrumentation, tests, and evidence collection—without allowing execution planning to redefine the upstream promise or measurement validity decision.

- 2026-09-09T22:09:00.000Z Review correction: Preserved M1 as contract definition by adding explicit affected-surface skips; YCFFNC in M2 owns installed host delivery and real-boundary proof.
