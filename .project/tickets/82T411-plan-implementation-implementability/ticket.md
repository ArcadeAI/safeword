---
id: 82T411
slug: plan-implementation-implementability
type: epic
phase: define-behavior
status: in_progress
phase_anchors:
  - define-behavior: dimensions.md
scope:
  - split feature planning into an Implementation Plan phase for approach decisions and an Execution Plan phase for startable build and test sequencing
  - give each phase one canonical author-review contract with fail-closed content identity, context, provenance, fallback, and invalidation checks
  - route architecture, data, and testing guidance into the phase where each decision belongs, while keeping one feature design plan of record
  - preserve early BDD decision discovery as a first-class, scope-bounded method and apply it proportionally to features, tasks, and patches
  - deliver and prove equivalent workflow behavior across every supported local agent host, applicable cloud host, and the Safeword CLI
  - migrate in-flight feature tickets without invalidating work that already entered implementation under the prior accepted workflow
  - keep the Product Plan/spec authoritative for complete persona outcomes while making each planning approval explicit about what it does and does not establish
  - route disputed plan findings without letting a reviewer decide its own dispute, turn optional advice into mandatory scope, or strand headless work in a review loop
  - carry a complete feature Delivery Checklist in the Execution Plan, organize large contributions into independently reviewable pull requests, and apply the same delivery concerns proportionally to tasks and patches
  - repair incomplete or incorrect Implementation Plans through decision discovery and fresh review instead of ending at a rejection
  - keep accepted plans current when implementation-time decisions change the approach or execution, preserving still-valid work and evidence before resuming
  - prove that a plain feature request can travel automatically from intake through contract-quality plans and tested delivery into a completed review-ready pull request
out_of_scope:
  - external tracker storage or tracker-specific project-management ceremony
  - splitting the two plans by human versus agent audience
  - adding formal planning artifacts or independent planning reviews to tasks and patches
  - using structural parsers to judge semantic decision quality or implementability
  - requiring a durable architecture record for routine reversible choices or a failing test for non-behavioral patches
done_when:
  - a required semantic review confirms that the Implementation Plan decides every in-scope behavior-shaping architecture, contract, data, rollout, rollback, and proof-scope choice without requiring execution sequencing
  - the Implementation Plan review receipt explicitly passes or fails whether its decision summary supports a focused 30–60 minute review and names any execution detail that obscures a decision
  - a required semantic review confirms that the Execution Plan maps every accepted obligation to dependency-ordered work whose first step can start without inventing or changing a decision
  - author and reviewer inputs carry a digest of the same canonical contract bytes, and missing, edited, or mismatched contracts or required context cannot produce approval
  - changing accepted scope, behavior, an Implementation Plan, or an Execution Plan invalidates exactly the reviews that depend on that change
  - feature, task, and patch routing keeps small work lightweight while promoting unresolved consequential in-scope decisions to the appropriate feature phase
  - acceptance scenarios prove the workflow and recovery behavior on every affected surface or record a specific justified skip at the real surface boundary
  - every new block or invalidation tells a non-technical builder in plain language what failed, why work stopped, and the one concrete action that resumes it
  - tickets already implementing under an accepted legacy plan continue without retroactive blocking, while earlier in-flight tickets enter the new phases through a defined migration
  - Product, Implementation, and Execution Planning each declare purpose, entry, required and prohibited content, review question, approval meaning, invalidation, and return path without one approval impersonating the next
  - disputed findings reach the authority that owns the disagreement, preserve nonblocking advice as nonblocking, and terminate honestly without reviewer self-adjudication or false approval
  - every contribution begins with a visible proportionate Delivery Checklist, and every large feature contribution is organized into coherent dependency-ordered pull requests with explicit proof and safe completion signals
  - an incomplete or incorrect Implementation Plan returns through decision discovery and exact-content re-review until complete and correct or honestly waiting on external authority
  - an implementation-time design change refreshes and re-reviews both plans, while a sequencing-only change refreshes and re-reviews only the Execution Plan; valid completed work and evidence survive either loop
  - on every supported authoritative host, a plain feature request can traverse intake, behavior definition, both planning stages, TDD, verification, delivery checks, and pull-request preparation while leaving strong Product, Implementation, and Execution Plans behind
product_plan_contract: v1
created: 2026-09-08T05:11:31.804Z
last_modified: 2026-09-10T18:43:58.353Z
external_issue: https://github.com/ArcadeAI/safeword/issues/4200
children: ['G1C9PP', '7CAMAD', '5F5ZZA', 'K3EBHB', 'YCFFNC', '3EG00H', '6XW8H7', 'A639WN', '26FK42', 'ZSHVEB', 'CGRX0H']
---

# Separate implementation decisions from execution sequencing

**Goal:** Give implementation decisions and execution sequencing distinct
workflow phases with distinct, canonical author-review contracts.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-10T18:43:58.353Z Scope linkage: Added ZSHVEB as the M1 child for GitHub issue #4366. It owns reusable technical-writing guidance plus the plan-specific extension consumed by Product, Implementation, and Execution Plan authoring and review; the existing phase contracts remain authoritative for behavior.

- 2026-09-10T00:14:30.000Z Scenario completeness accepted: User approved the nine-child scenario set after rule-lineage reconciliation, removal of stale moved behavior, and addition of plan repair, full prompt-to-PR, implementation-time replan, dispute, delivery-checklist, and plain-recovery examples. Independent child reviews are next.

- 2026-09-09T23:46:25.000Z Intake accepted: User approved Product Bet and jobs, Rules, Shape and all three Killer Demo journeys, and engineering scope. The content-bound Product Plan self-review passed against current principles, personas, surfaces, scope, and non-goals; advanced to behavior definition so child scenario packets can be refreshed.

- 2026-09-09T23:46:01.000Z Engineering-scope approval and self-review correction: User approved the complete engineering scope. Self-review found that the three accepted demonstrations were not explicit in the epic completion checklist, so added plan repair, implementation-time replanning, and the plain-prompt-to-review-ready-PR journey as observable completion conditions.

- 2026-09-09T23:42:56.000Z Third demo: User required implementation-time decisions to route back to the plan they affect, receive fresh review, and then resume implementation. Design changes refresh both plans; sequencing-only changes refresh only the Execution Plan; still-valid work and evidence survive the loop.

- 2026-09-09T23:39:27.000Z Shape approval and second demo: User approved the three-milestone delivery order and repair-loop demo, then added an end-to-end golden journey: a plain request such as MCP notification support must travel automatically from intake through excellent Product, Implementation, and Execution Plans into tested implementation, completed delivery checks, and a review-ready PR without claiming merge authority.

- 2026-09-09T23:38:16.000Z Shape feedback: User rejected a Killer Demo framed around blocking an incomplete plan. Reframed the proof around the actual value: review returns to Implementation Planning, the complete current set of missing or incorrect decisions is filled through the proper owners, corrected bytes are re-reviewed until complete and correct, and only then does Execution Planning begin.

- 2026-09-09T23:35:34.000Z Product Plan checkpoint: User approved the Rules governing phase responsibilities, guide use, proportional small-work handling, review currency and authority, dispute routing, and plain-language recovery. The next checkpoint is Shape and Killer Demo.

- 2026-09-09T23:31:48.000Z Product Plan checkpoint: User approved the Product Bet and job set, including plain-language recovery for pending human design approval and pending user-owned scope or dispute decisions. The next checkpoint is the Rules that govern those jobs.

- 2026-09-09T23:04:09.000Z Ownership simplification: Made A639WN the canonical checklist evidence-taxonomy owner consumed by 7CAMAD, moved the feature-TDD sequencing obligation wholly from TBU3 into TBU2, and separated Product Plan outcome inventory from later scenario-coverage proof.

- 2026-09-09T22:57:07.000Z Lineage correction: Added explicit parent Rules for Implementation Plan persona consequences, planning-versus-implementation state separation, and retrofitted-plan reconciliation so child obligations cannot sit outside digest-protected accepted scope.

- 2026-09-09T22:44:47.000Z Final ownership correction: Assigned Product Plan persona-outcome and epistemic-status enforcement to 5F5ZZA, added checklist and PR-slicing delivery to M2, gave 3EG00H the proportional small-work half of the Killer Demo, and made evidence currency a single 7CAMAD-owned vocabulary.

- 2026-09-09T22:33:02.000Z Proof-ownership correction: Assigned cross-host installed phase behavior to YCFFNC in M2 and assigned the complete rejection-then-correction cold-start demo to 7CAMAD at the Safeword CLI boundary.

- 2026-09-09T22:28:06.000Z Full-epic quality review correction: Added Delivery Checklist and reviewable-PR slicing to the accepted scope, completion threshold, and milestone outcomes. M1 now defines the feature checklist and slicing contracts before the integrated Execution Plan; M3 owns only their lightweight task and patch adaptation.

- 2026-09-09T22:19:12.000Z Quality review correction: Kept the integrated cold-start Killer Demo provable in M1 at the Safeword CLI boundary while deferring other installed-host delivery to M2. Explicitly blocked every child from earning a new approval or entering implementation until the materially expanded Product Plan receives a fresh approval.

- 2026-09-08T05:09:19.067Z Intake: Figure-it-out compared universal design docs, typed plan fields, and an implementer-readiness review criterion. Chose explicit deep-design routing plus independent semantic review; kept the transition parser structural.
- 2026-09-08T05:11:31.804Z Started: Created ticket 82T411
- 2026-09-08T05:28:35.807Z Intake: User feedback established the audience split. The organization already owns a human Implementation Plan in its project tracker; Safeword should produce a derived agent Execution Plan, not a second implementation plan.
- 2026-09-08T05:31:38.768Z Intake: User chose two consecutive workflow phases: Implementation Plan for human review and approval, then Execution Plan for agent build and test instructions.
- 2026-09-08T05:33:54.524Z Intake correction: The phase boundary is purpose, not audience. Implementation Plan decides the approach and serves humans and agents; Execution Plan organizes the accepted approach into startable work.
- 2026-09-08T05:36:02.589Z Intake: Each phase will define one canonical quality contract shared byte-for-byte by its author and independent reviewer, following the scenario-rubric pattern.
- 2026-09-08T05:43:19.581Z Intake correction: External tracker storage is Arcade-specific and out of scope. Both phase artifacts remain project-local and use Safeword's current review and enforcement mechanics.
- 2026-09-08T05:51:13.000Z Intake: Quality-review findings were applied. The Implementation Plan is the single feature design record; architecture applicability is checked inside it, data guidance is conditional, significant decisions also update the durable architecture record, Execution Plan implementability is judged semantically, and structural gates remain limited to observable provenance.
- 2026-09-08T05:53:38.000Z Intake confirmation: User accepted the architecture and data guide boundary, including significance-based durable architecture routing and retirement or redirection of the separate feature-design path.
- 2026-09-08T05:57:29.000Z Intake confirmation: User accepted the testing boundary. Implementation planning chooses proof scope and confidence; execution planning specifies exact test mechanics; implementation follows TDD; changes to proof scope or claimed behavior return to Implementation Planning.
- 2026-09-08T05:59:41.000Z Intake confirmation: User required independent semantic review for both planning phases. Implementation Plan approval authorizes Execution Planning; Execution Plan approval authorizes coding.
- 2026-09-08T06:15:41.000Z Intake: Split today's mixed phase prompt by responsibility. Decision outcomes belong to the Implementation Plan contract, executable decomposition belongs to the Execution Plan contract, authoring technique remains guidance, and artifact/current-review facts remain structural enforcement. Figure-it-out replaced the mandatory exact Implementation Inspiration table with a format-flexible, compact Decision Evidence requirement for load-bearing choices; the template may still offer a table as an authoring aid.
- 2026-09-08T06:17:48.000Z Intake confirmation: User accepted the format-flexible Decision Evidence contract for load-bearing choices, with a compact table retained only as an optional authoring aid.
- 2026-09-08T06:23:21.000Z Intake correction: Reuse means elevating early BDD's progressive decision-discovery method into a first-class cross-workflow principle, not merely reusing today's implementation-plan machinery. Added the principle to PRINCIPLES.md and made it an explicit outcome and Rule for Implementation Planning.
- 2026-09-08T06:31:57.650Z Intake: Extended decision discovery proportionally across work types without adding feature-sized ceremony. Patches use a narrow first-match contract and targeted verification; feature triggers take precedence next; tasks are the bounded fallback and use inline proof plus TDD. A fresh-context fallback review found overlapping predicates, so the contract now defines this explicit routing order. TDD may settle reversible local implementation choices, but discovery of a behavior-shaping, shared, durable, data, migration, compatibility, or proof-boundary decision promotes the work to the appropriate feature phase.
- 2026-09-08T14:07:36.775Z Intake: Applied the scope and review-lifecycle lessons from draft PRs #4218 and #4206. Decision discovery is now explicitly bounded by accepted scope; both planning phases receive complete current scope and inherited context, fail closed when it is missing, check for both omissions and overreach, keep strengthening user-directed, and invalidate dependent reviews when artifacts or load-bearing context change. Task and patch promotion now applies only to consequential decisions required by accepted in-scope work.
- 2026-09-08T16:30:00.000Z Intake: Closed the independent-review blockers by defining the ticket boundary, naming observable completion, making the packaged phase contract authoritative with fail-closed identity checks, enumerating affected host surfaces, removing duplicate phase rules, and preserving machine-checkable decision-evidence anchors without prescribing one research table.
- 2026-09-08T16:38:00.000Z Intake: The inline spec review restored the original user constraint: the Implementation Plan must support a focused 30–60 minute decision review without becoming an execution manual, while keeping technical detail that carries a decision.
- 2026-09-08T16:40:00.000Z Intake: Applied the second independent review. Contract identity now binds exact contract bytes; independent review remains preferred but the established exhausted-route fallback is explicit and honestly recorded; NTB recovery is a first-class job; every legacy guide route, cloud surface, in-flight-ticket migration, evidence check, and reviewability boundary has a defined disposition.
- 2026-09-08T16:47:04.000Z Intake: Applied the third independent review. Preserved the current untrusted-evidence and no-private-egress controls in the shared contract, assigned the existing human approval gate once to the approach decision, made required review context and residual task routing total, and classified every configured project surface.
- 2026-09-08T17:10:10.000Z Intake: Applied the closing review's traceability finding. Added a numbered receipt obligation for the 30–60 minute reviewability judgment, split legacy-guide dispositions into independently provable Rules, defined project-context fallbacks and semantic normalization for provenance, made zero-decision evidence explicit, and required advisory labeling where Codex Cloud receives instructions without gates.
- 2026-09-08T17:28:00.000Z Define behavior: Independent intake review approved with cross-agent Claude Opus coverage. Entered scenario authoring with 13 material dimensions spanning phase boundaries, planning quality, context and provenance, guide migration, work-type routing, TDD return paths, recovery messages, and host parity.
- 2026-09-08T17:40:00.000Z Split: User approved the define-behavior decomposition after figure-it-out found 63 scenarios across six distinct behavioral clusters, above Safeword's 15-scenario or three-cluster threshold. Promoted 82T411 to the Product Plan epic; child features inherit its approved jobs, milestones, success threshold, and non-goals through the contract digest, while the Killer Demo is inherited by reference and its load-bearing obligations are repeated in stable Rules.

- 2026-09-09T15:27:00.000Z Scope addition: User added child 6XW8H7 so Execution Plans explicitly divide large contributions into independently reviewable pull requests.

- 2026-09-09T15:44:00.000Z Scope addition: User added child A639WN for an Arcade-inspired Safeword-default Delivery Checklist. Safeword creates it before execution, completes it with the contributor, scales it across work types, and separates contributor readiness from human approval; automatic repository-policy discovery remains out of scope.

- 2026-09-09T16:45:00.000Z Contract refinement: Applied lessons from tightening a real emergency-control plan across all three planning goals. The Product Plan/spec owns complete persona outcomes and distinguishes facts, assumptions, and unresolved product decisions; the Implementation Plan owns the accepted design; the Execution Plan owns current-to-target work, PR and task decomposition, TDD mechanics, the Delivery Checklist, and evidence currency. Each approval now has an explicit meaning, invalidation boundary, and return path and cannot stand in for the next approval.

- 2026-09-09T21:49:00.000Z Contract refinement: A cross-agent quality review kept the simple planning lessons—decision-depth modeling for significant workflows, split measurement ownership, exact-byte approval, and reviewer non-authority—while rejecting a bespoke convergence counter and self-adjudicating dispute path. Added child 26FK42 so disputed-finding resolution is designed and proven as its own JTBD instead of hidden inside the two-plan contracts.

- 2026-09-09T21:50:00.000Z Dogfood finding: The newer emergency-control planning turns resolved break-glass availability, authoritative versus diagnostic reads, retention and compaction, registry fallback, database enforcement, capacity, action-specific permissions, and supported-client scope through one-question-at-a-time owner decisions. This confirms that a reviewable plan may surface open decisions but cannot authorize Execution Planning until blocking choices close; quantitative release claims need workload and environment as well as a threshold; and Product records user-visible consequences while Implementation records mechanisms. A remote Linear edit also truncated the plan, which is an artifact-transport integrity issue rather than a reason to expand #4200's project-local storage scope.

- 2026-09-09T22:03:00.000Z Review state: The 2026-09-08 intake approval is stale because the Product Plan gained material jobs, Rules, and non-goals on 2026-09-09. Child parent-contract anchors were reconciled only as explicit acknowledgement of the changed parent slices; the epic requires a fresh Product Plan review before the expanded contract is treated as approved.
