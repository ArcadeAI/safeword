---
id: G1C9PP
slug: approve-coherent-implementation-plans
type: feature
phase: scenario-gate
status: in_progress
phase_skips:
  - "intake: inherited the user's 2026-09-09 acceptance of the refreshed 82T411 Product Plan and its current parent contract"
  - "define-behavior: partitioned the accepted 82T411 Rule and scenario packet at Safeword's documented split restart point"
phase_anchors:
  - scenario-gate: features/approve-coherent-implementation-plans.feature
  - plan-implementation: .project/tickets/G1C9PP-approve-coherent-implementation-plans/impl-plan.md
  - implement: .project/tickets/G1C9PP-approve-coherent-implementation-plans/impl-plan.md
scope:
  - define Implementation Planning as the phase that resolves and approves behavior-shaping approach decisions
  - make the project-local Implementation Plan the single design record for architecture, data, rollout, rollback, and proof-scope choices
  - require compact, evidence-backed decision summaries that support a focused 30–60 minute review
  - give reviewers an architecture-at-a-glance mental model, explicit unresolved-decision state, and consequences for every accepted persona
  - distinguish proposed design, existing implementation, available proof, known defects, and pending human authority when those states coexist
  - apply the existing optional human design approval once to the reviewed approach without duplicating it after Execution Planning or deadlocking headless work
  - preserve exact-plan approval authority when shared review-ledger writes overlap, stop, retry, time out, or encounter compatible unknown events
  - require decision-depth state and measurement models when significant behavior depends on them
  - repair incomplete or incorrect plans by returning to decision discovery, filling the known gaps through the proper decision owners, and re-reviewing the corrected plan
out_of_scope:
  - execution sequencing, coding instructions, exact test commands, and first-RED mechanics
  - review transport, provenance, review-record invalidation, fallback, and migration behavior owned by sibling 5F5ZZA
done_when:
  - every in-scope behavior-shaping choice is decided or explicitly marked not applicable before Execution Planning
  - load-bearing choices record credible alternatives and current evidence without prescribing one table format
  - semantic review can judge the plan in a focused meeting and names execution detail that obscures a decision
  - applicable data decisions cover purpose, ownership, identity and integrity, lifecycle and retention, migration, and rollback without embedding execution instructions
  - a plan cannot imply that implemented means proven or that independent review means human approval
  - significant concurrency, security, durability, lifecycle, migration, compatibility, and quantitative choices are sufficiently decided without absorbing execution mechanics
  - human design approval, when configured, is requested once on the reviewed approach and remains honestly pending where the surface cannot collect it
  - concurrent or interrupted approval writes cannot lose, duplicate, invent, or silently invalidate review authority
  - an incomplete or incorrect plan is iteratively completed and corrected rather than ending at a rejection message
product_plan_contract: v1
parent: 82T411
parent_job: plan-implementability.TBU1
milestone: M1
created: 2026-09-08T17:36:33.419Z
last_modified: 2026-09-10T23:31:00.000Z
parent_contract_digest: c08988d3ae35252d5e18057f1332f7638bf55dfc0a4b230581386afac25da34a
---

# Approve coherent Implementation Plans

**Goal:** Make every feature approach complete, reviewable, and evidence-backed before sequencing

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-10T23:31:00.000Z Scenario review polish: Independent review `048e6841-6d50-4dec-88ea-98125a6e4b6b` approved the 47/47 packet. The refreshed 48/48 packet closes a resolved-path escape in the configured ADR-directory edit gate and moves absent decision-bearing content into a standalone R3 scenario so the presentation outline varies one mechanism. Proof-currency audit confirms the current R4, R5, R6 migration-command, R7 routing, R8 significance, and R10 verification-ledger rows all predate their recorded RED/GREEN/REFACTOR commits; their ledgers remain current.

- 2026-09-10T23:24:45.000Z Scenario review polish: Independent review `41a56fd0-56a9-4dc9-a4f8-cc004b852cb2` approved all 47 scenarios with no blocking defect. Applied its three remaining clarity findings: R13 names the installed CLI boundary in the scenario, R19 preserves the bounded contention fixture guarantee in the ledger, and headless delivery of the reviewed approach is explicitly skipped to sibling `YCFFNC` while this ticket retains pending-authority and nonblocking CLI proof. Exact bytes require one final approval before stamping.

- 2026-09-10T23:18:00.000Z Scenario review repair: Independent review `ee5afe4d-9f75-4b60-8da8-4ee654b541fe` found four bundled omission results that a partial checker could satisfy. Each result now enumerates every omitted R6/R17 obligation, and R13's evidence-field structure is exercised through the installed CLI. R10's verification-ledger row was introduced in `ddaebbdb0c` before its later RED/GREEN/REFACTOR proofs (`6b72a8724`, `ec3a723a5`, `58aebd530`), so that ledger remains current.

- 2026-09-10T23:13:00.000Z Scenario review repair: Independent review `1b5d8b7a-5254-4b92-805e-9898e1b44710` found that bundled omission rows could pass without checking why an alternative lost or whether an applicable-version field exists. The refreshed 47/47 packet isolates both obligations, independently rejects evidence-ledger bloat, proves plain idempotent retry, and requires a real terminal boundary when proving that a review-blocked plan never prompts.

- 2026-09-10T23:05:42.000Z Scenario review polish: Independent review `644f5a4d-eac4-489e-bafb-17257f72e141` approved the reconciled 45/45 packet and identified four non-blocking proof gaps. The refreshed 46/46 packet adds the coherent-ownership counterpart, places all interactive decisions behind a real terminal boundary, makes contention ordering a bounded fixture guarantee, and records why R6/R17 need one acceptance partition per Rule-named family while lower-level tests own intra-family permutations. Historical 41-scenario entries describe earlier packets; the current packet has 46 scenarios.

- 2026-09-10T22:23:00.000Z Returned to Scenario Gate before implementation: independent Implementation Plan review `64f969e3-8fd9-4cbf-872b-423f70e2e7e9` found that the accepted plan and architecture record introduced shared approval-ledger concurrency, crash-recovery, idempotency, timeout, and compatibility behavior without accepted scenarios. No implementation begins until those externally meaningful outcomes enter the behavior contract, the complete scenario packet is reviewed, and the revised exact plan is independently re-approved.

- 2026-09-10T19:15:00.000Z Returned before production change: Executable-RED review `50fa4abb-9611-4ed6-8cea-d04f599ba606` approved the corrected R11 contract proof, then identified that the accepted Implementation Plan conflated R11's pure packaged-contract matrix with its separate installed-CLI receipt proof. Returned to Implementation Planning to split those proof boundaries and re-review the exact plan before resuming GREEN.

- 2026-09-10T10:48:00.000Z Implementation Planning complete: Claude Opus approved the exact committed, formatter-stable Implementation Plan bytes with cross-agent provenance (review `0342d73b-7936-4ec0-86d2-121d466c1153`). The refreshed stamp replaces the stale pre-format receipt; the ticket re-enters implementation with its reviewed plan as the phase anchor and no code changes made before approval.

- 2026-09-10T10:40:00.000Z Returned before implementation: The planning checkpoint's pre-commit formatter changed the reviewed Implementation Plan bytes, and `review status 79604310-795c-4de4-8f5d-e7570744e3b8` correctly reported `REVIEW_STALE`. No code work began. Refreshing independent review against the committed formatted artifact before re-entering implementation.

- 2026-09-10T10:35:00.000Z Implementation Plan independently approved: Claude Opus could not find a release-relevant failure in the final planned design (review `79604310-795c-4de4-8f5d-e7570744e3b8`). The parse-valid plan has planned status, all required sections plus Doc impact, names R1 as the riskiest assumption and proving scenario, covers all 20 Rules, and records honest surface/proof limits. Stamped the exact plan bytes. The split checkpoint found six ordered steps across five major components, below the greater-than-five-component split trigger, so the ticket advances without further decomposition under the currently installed workflow.

- 2026-09-10T10:22:00.000Z Implementation-plan review correction: Defined the linked-detail versus competing-plan boundary, reordered installed CLI proof before approval/repair proof, specified decline state, designed the project-local digest-bound approval ledger with atomic/idempotent recovery, added per-decision evidence applicability, deferred integration activation semantics honestly to YCFFNC, and named schema ownership as an existing regression lane rather than accepted feature behavior.

- 2026-09-10T10:05:00.000Z Scenario gate independently approved: Claude Opus approved the exact current 36-scenario packet with full parent, persona, surface, scope, determinism, and Killer Demo context (review `d1e0b260-c185-4d6c-abfb-a9a61ddefe19`). Stamped the exact bytes and returned to Implementation Planning. The plan now drops an unsupported child claim about missing-contract recovery and records the live-reviewer limitation of deterministic semantic conformance proof.

- 2026-09-10T09:52:00.000Z Final scenario clarity pass after approval: Isolated R3's linked-detail dimension, named semantic review as R13's free-form evidence judge, expressed R14 authority in business language while corroborating 5F5ZZA ownership in ticket scope, added R7's sibling-path near miss, added R18 missing/bare/justified applicability rows, and removed the lone inconsistent rejection tag. Scenario identities remain 36/36.

- 2026-09-10T09:44:00.000Z Scenario review correction: Pending headless approval now explicitly holds before Execution Planning, human decline returns the exact approach to Implementation Planning, authorization and migration have positive counterparts, measurement has a no-promise applicability case, the Killer Demo ends in an observable clean receipt, and R12's missing-evidence state is unambiguous. R14 now honestly proves typed-input consumption versus absence while deferring authentic production and anti-forgery provenance to 5F5ZZA.

- 2026-09-10T09:32:00.000Z Scenario strengthening: Added a non-API migration/compatibility significance case to R8, made the Killer Demo expose the full first receipt and bind approval to corrected rather than original bytes, and recorded that R19 proves human-approval currency only while 5F5ZZA owns review-record invalidation and provenance.

- 2026-09-10T09:28:00.000Z Scenario and plan correction: Added R7's installed planning-gate allow/deny behavior as scenario 35. The plan now preserves the full eleven-part data decision surface, resolves feature personas from the accepted Product Plan, treats the 30–60 minute promise as a timestamped Product-owned review study rather than reviewer self-report, and assigns free-form evidence-field completeness to semantic review while the parser checks only observable section/applicability structure.

- 2026-09-10T09:20:00.000Z Returned to scenario gate after an approved plan review: Review `528576c2-5d0b-4c67-b17e-0d85ad48b4c4` found that the newly chosen planning-time architecture-path exception had no accepted scenario or ledger entry. Because that enabler changes a shared access-control invariant, it must become explicit behavior before implementation. The same correction pass will make four plan decisions unambiguous without expanding scope.

- 2026-09-10T09:05:00.000Z Scenario gate independently approved: Claude Opus approved the exact 34-scenario feature/ledger packet with full parent, persona, and surface context (review `7e643bf1-2692-4931-b839-ca8f7cb57425`). All 20 Rules, inherited non-goals, the child-owned Killer Demo slice, ordering safety, and affected-surface boundaries passed. Stamped the exact bytes and returned to Implementation Planning. Non-blocking proof-strength notes are carried into the plan as mutation-based contract conformance, full architecture-trigger matrices, human-approval-only R19 scope, and digest-bound R20 loop evidence.

- 2026-09-10T08:50:00.000Z Scenario strengthening after approval: Made linked-only versus wholly absent decisions explicit in R3, changed R8 from an internal significance label to the observable durable-record obligation, added a complete concurrency acceptance row to prevent per-concern over-blocking, and bound untagged RED/GREEN proof to actual packaged contract bytes rather than scripted verdicts. A fresh exact-byte review is required.

- 2026-09-10T08:42:00.000Z Scenario review correction: Made the architecture-at-a-glance requirement independently falsifiable, added the missing preserved-evidence negative case for significant durable workflows, and replaced an invented product-owner role with the parent-defined user authority. The 34 scenario identities and ledger headings remain unchanged.

- 2026-09-10T08:35:00.000Z Scenario review correction: Added a concurrency-specific missing-atomicity/retry row to R17 and moved Non-Technical Builder recovery wording to the installed Safeword CLI boundary. Scenario headings remain a matched 34/34; the refreshed review packet includes the parent Product Plan for inherited non-goals and Killer Demo judgment.

- 2026-09-10T08:30:00.000Z Returned to scenario gate: Review `8e153ca5-3531-4227-b769-f4607e3418ee` could not check inherited boundaries because the parent spec was omitted from its context. It also found that concurrency-specific atomicity/retry enforcement and real CLI rendering of builder recovery were not directly falsifiable. The next packet will add those proofs and include the parent Product Plan.

- 2026-09-10T08:15:00.000Z Implementation-plan review correction: Resolved the architecture-record/code-freeze circularity by designing a narrow configured-architecture-path planning exception and a one-time logged bootstrap transition to record this decision. Corrected the R4 proof boundary, distinguished missing-contract restoration from contract drift, exposed the R14 fixture-provenance limit in the verification ledger, and restated assessment triggers in terms of evidence the design actually emits. Because the ledger bytes changed, the scenario review stamp must be refreshed before implementation-plan approval can advance.

- 2026-09-10T07:26:00.000Z Scenario gate independently approved: Claude Opus approved the exact current feature and ledger bytes with cross-agent provenance (review `2ec9a6ac-7080-4146-a710-655d1f487dcd`) after headless completion, accepted-persona completeness, state truthfulness, data mechanics, and stale human-approval precedence were made falsifiable. The files contain 34 matched scenario headings; the review narrative's 33-scenario count is a nonbinding counting error. Stamped the reviewed bytes and returned to Implementation Planning.

- 2026-09-10T07:18:00.000Z Scenario review correction: Added the stale-human-approval case after an Execution Plan exists, bound approval currency specifically to the approved approach bytes, made the no-approval path observable, declared the deterministic packaged-contract conformance boundary, and required repair decisions to come from their accepted owners.

- 2026-09-10T07:09:00.000Z Scenario review correction: Moved headless approval to a real non-interactive CLI completion boundary, made live-review scenarios deterministic at the reviewer process edge, separated data execution mechanics into a coherent scenario, made plan claims part of Given state, added independent-review-versus-human-authority rejection, and clarified that approval currency is separate from sibling-owned review-record invalidation.

- 2026-09-10T07:00:00.000Z Scenario review correction: Replaced the contradictory zero-implementation row with a true coexistence case, added missing identity/integrity and migration-command data cases, made persona omission a review event, and stated that human approval binds exact approach bytes and must refresh after an approach change.

- 2026-09-10T06:51:00.000Z Scenario review correction: Bound headless approval to returning control without an approver, added a two-persona omission rejection, distinguished structural from semantic evidence failures, made simultaneous blocking proof run through the installed CLI, and removed a non-falsifiable invalidation disclaimer.

- 2026-09-10T06:50:00.000Z Returned to scenario gate: Fresh independent review found two behavior-level gaps in the current packet—headless approval could emit pending state and still wait forever, and persona coverage could ignore an accepted persona entirely. Returning before changing scenario bytes.

- 2026-09-10T06:43:00.000Z Implementation Planning resumed: Parent reconciliation is healthy and every epic child has cleared scenario review. Removed the obsolete parent blocker and began revalidating the existing planned design against the expanded current scenarios and plan contract.

- 2026-09-10T01:38:23.000Z Scenario gate: The standard coordinator's Claude Opus and Sonnet routes timed out on the final 31-scenario packet (`6331924c-3fbd-402e-973d-4c19c0111d53`). Under the configured `prefer` policy, the required one-shot fallback completed a main-thread review with no remaining findings after the exact Rule text, approval boundary, and iterative repair convergence were tightened. Advanced without an independent stamp; independence remains honestly recorded as none.

- 2026-09-09T23:38:16.000Z Killer Demo correction: User clarified that finding an incomplete plan is not the payoff. This child now owns the return-to-planning loop that exposes the full current defect set, fills the missing decisions through their proper owners, and re-reviews corrected bytes until the plan is complete and correct or honestly waiting on external authority.

- 2026-09-09T23:10:11.000Z Parent reconciliation: `--accept` updated the current parent-contract digest to `02ab8c3c4aa97ca39513ebeb214c703297132ee82a970296738d56fc16368f70` after the 23:04 Product Plan changes.

- 2026-09-09T22:57:07.000Z Lineage correction: Parent TBU1 now explicitly owns this child's persona-consequence discovery and planning-versus-implementation state-separation obligations, so parent reconciliation can detect changes to them.

- 2026-09-09T22:28:06.000Z Ownership correction: Moved the one-time human approach-approval obligation here so this TBU1 child owns and digests the parent Rule it implements.

- 2026-09-09T22:19:12.000Z Review gate correction: Recorded the stale parent approval as an explicit blocker; existing scenario work is preserved, but this child cannot earn another approval or enter implementation until 82T411 is freshly approved.

- 2026-09-08T17:36:33.419Z Started: Created ticket G1C9PP

- 2026-09-08T18:05:00.000Z Define behavior: Bounded this child to approach-decision quality and 15 inherited obligations.

- 2026-09-08T18:20:00.000Z Scenario gate: Partitioned 15 inherited Rules into child-owned scenarios and R/G/R ledger entries; independent scenario review remains pending.

- 2026-09-08T18:37:46.090Z Scenario gate: All independent routes were exhausted. Main-thread supplemental review found no must-fix issue; no independent stamp was written, so the child remains at scenario-gate.

- 2026-09-08T21:04:19.000Z Scenario gate: Claude Opus independently approved the 22-scenario packet with cross-agent provenance (review `0ad646fa-3cb4-4a70-ab08-f76ce397ff6e`); recorded the scenario-gate stamp and advanced to Implementation Planning. Non-blocking review warnings remain inputs to implementation planning.

- 2026-09-09T05:11:30.000Z Implementation planning: Claude Opus independently approved the final current Implementation Plan with cross-agent provenance (review `2002755a-92f9-4560-af5b-459f0283077c`). The trusted receipt stamp was recorded through the cache-busted distribution bundle, and the ticket advanced to implementation; sibling delivery prerequisites remain explicit in the plan.

- 2026-09-09T16:18:00.000Z Returned to scenario gate: A real emergency-control plan review showed four material requirements the existing contract implied but did not state strongly enough—an architecture-at-a-glance mental model, persona consequence coverage, decision-bearing data depth, and explicit separation of proposed, implemented, proven, defective, and human-authority states. Preserved completed TDD evidence while reopening the affected scenarios and plan.

- 2026-09-09T21:49:00.000Z Scenario impact: Added decision-depth state/authority/atomicity/retry/evidence modeling for significant workflows and split quantitative ownership across Product, Implementation, and Execution Planning. Existing scenario coverage must be updated before this child can leave scenario gate.

- 2026-09-09T22:03:00.000Z Review correction: Restored the complete parent-owned data-decision surface in the child Rule, including store/model, schema/relationships, source of truth, access, cross-system flow, backfill, and compliance.

- 2026-09-09T22:09:00.000Z Review correction: Preserved M1 as contract definition by adding explicit affected-surface skips; YCFFNC in M2 owns installed host delivery and real-boundary proof.

- 2026-09-10T19:23:00.000Z Implementation Plan review repair: Clarified approval ownership across G1C9PP, 7CAMAD, and 5F5ZZA; placed R2 extraction-to-receipt integration in build order; added sibling-path and concurrency proof; decided decline and unknown-ledger-event compatibility; and documented transitional template and architecture-freeze limitations. Exact corrected bytes require a fresh independent plan review before implementation resumes.

- 2026-09-10T19:34:00.000Z Implementation Plan review repair: Independent review b501494e-06ce-46f3-8129-9b21b7b2d7a3 approved the approach and exposed non-blocking ambiguities. Tightened obligation-naming receipts, stale-approval CLI ownership, current delivery-state truth, bounded competing-plan discovery, lock-based append serialization, quantitative ownership, host-deferral prose, and the reverse-marker rationale. Re-review is required because these corrections change the approved bytes.

- 2026-09-10T19:41:00.000Z Returned to scenario gate: Independent review e88f5507-056d-4dea-b6cf-a73202ae0358 found that R7's configured architecture record can be either a file or an ADR directory, while the accepted examples only discriminated the file case. The scenario contract must decide directory-child admission and adjacent-path denial before the plan can be approved.

- 2026-09-10T19:44:00.000Z Scenario repair: Expanded R7's installed planning-gate outline to distinguish an exact configured file from a configured ADR directory. A directory permits only direct `YYYYMMDD-slug.md` children; non-dated children, nested paths, paths outside the directory, and ordinary source/documentation paths remain blocked.

- 2026-09-10T19:48:00.000Z Scenario review repair: Independent review 83c5c5b1-2118-43a5-8fbb-1a36204d34aa correctly found R7's prior proof stale after the outline expansion, so its RED/GREEN/REFACTOR ledger is reopened and its heading reconciled. Demoted malformed R1/R3 ledger headings and made R9 distinguish subordinate linked detail from a competing authoritative plan.

- 2026-09-10T19:55:00.000Z Scenario review repair: Independent review af003c01-abc1-4329-a5af-3bf91557d6ce found a contradiction at the R3/R9 linked-detail seam. Required decisions and consequences now remain named in the plan, R9 splits independent authority from an unnamed decision, R2 covers an absent packaged contract, R13 assigns evidence-field presence to structural checks including retrieval date, and R19 gains a real installed-CLI approval path. The packet now contains 37 scenarios.

- 2026-09-10T20:02:00.000Z Scenario review repair: Independent review 1d938343-94ae-4f06-a1f5-376afd3ebd32 found stale proof claims after R2, R3, and R9 expanded, so those ledgers are reopened; R6 is also reopened after adding the incorrect-owner detection that backs the Killer Demo. Split every R7 path alternative into one concrete row and moved the Technical Builder receipt to the installed CLI boundary. The larger R6/R17 matrices remain because their enumerated concern families are the accepted Rule boundary; lower-level tests own exhaustive permutations within each family.

- 2026-09-10T20:09:00.000Z Scenario review repair: Independent review 0a270b8e-0456-4ee1-ae4b-f4377d13b684 found that review-before-human-approval ordering was not falsifiable. Added the installed rejection path, made both persona receipts explicit real-CLI boundaries with concrete NTB jargon exclusions, and split contradictory data ownership from R6's missing-field matrix. The packet now contains 39 scenarios.

- 2026-09-10T20:16:00.000Z Scenario review polish: Independent review d361d0f0-ba04-4fa8-8a2a-8792eee5867a approved all 39 scenarios with three non-blocking clarity findings. R1 now explicitly disables human approval and its proof is reopened; R18 separates misplaced instrumentation from missing validity safeguards; and R15 binds jargon exclusion to the first user-visible sentence and recovery line.

- 2026-09-10T20:23:00.000Z Scenario review repair: Independent review 516bef0c-7a58-422c-8b46-33e5baa12caa found two R19 approval-currency scenarios outside their observable boundary. Both now run through the installed CLI; the child Killer Demo explicitly assigns its two unclaimed parent payoffs; R18 separates Product target from population; R7 removes path-class alternation; and R3 leaves receipt recovery wording to R15.

- 2026-09-10T20:30:00.000Z Scenario review polish: Independent review cfe50c42-5924-4fd9-a403-0306aed3ee45 approved all 39 scenarios. Applied every remaining warning: R19 now derives currency from changed or unchanged bytes; R15 begins from raw plan presentation; missing-contract recovery has an installed CLI scenario; R18 separates ownership from applicability; and the child Killer Demo names the exact partial payoff and deferred continuation. The packet now contains 41 scenarios.

- 2026-09-10T20:37:00.000Z Scenario review polish: Independent review b561dca2-0e46-40eb-9724-2d766a0b7db0 approved all 41 scenarios. Added discriminating R6 foundational-data and R17 lifecycle rows, made R14's fixture-minted authority and 5F5ZZA release limit visible in the scenario, and replaced R19's open-ended headless assertion with the settled ticket phase and pending approval state.

- 2026-09-10T20:45:00.000Z Scenario gate exit: The final exact-byte independent review exhausted both configured Claude routes after timeout (review d17299ff-19eb-49ed-bf6b-2e9c51c1a6bf). Under the trusted `prefer` policy, the one permitted fresh-context fallback also timed out; the bounded main-thread fallback approved the 41/41 reconciled feature and ledger with no findings and no claim of independence. Returned to Implementation Planning to reconcile the plan with the newly accepted scenarios.

- 2026-09-10T20:52:00.000Z Implementation Plan reconciliation: Updated delivery-state truth for reopened proofs; added installed missing-contract recovery; decided bounded design-record discovery; added lease fencing and local-filesystem limits; specified file-versus-ADR-directory edit admission; aligned evidence field ownership; moved the riskiest R1 boundary first; corrected architecture decision citations; and added a durable-ledger reassessment trigger. Exact plan bytes now require independent re-review.
