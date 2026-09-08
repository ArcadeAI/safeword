---
id: 82T411
slug: plan-implementation-implementability
type: epic
phase: intake
status: in_progress
scope:
  - split feature planning into an Implementation Plan phase for approach decisions and an Execution Plan phase for startable build and test sequencing
  - give each phase one canonical author-review contract with fail-closed content identity, context, provenance, fallback, and invalidation checks
  - route architecture, data, and testing guidance into the phase where each decision belongs, while keeping one feature design plan of record
  - preserve early BDD decision discovery as a first-class, scope-bounded method and apply it proportionally to features, tasks, and patches
  - deliver and prove equivalent workflow behavior across every supported local agent host, applicable cloud host, and the Safeword CLI
  - migrate in-flight feature tickets without invalidating work that already entered implementation under the prior accepted workflow
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
product_plan_contract: v1
created: 2026-09-08T05:11:31.804Z
last_modified: 2026-09-08T17:40:00.000Z
external_issue: https://github.com/ArcadeAI/safeword/issues/4200
children: ['G1C9PP', '7CAMAD', '5F5ZZA', 'K3EBHB', 'YCFFNC', '3EG00H']
---

# Separate implementation decisions from execution sequencing

**Goal:** Give implementation decisions and execution sequencing distinct
workflow phases with distinct, canonical author-review contracts.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

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
- 2026-09-08T17:40:00.000Z Split: User approved the define-behavior decomposition after figure-it-out found 63 scenarios across six distinct behavioral clusters, above Safeword's 15-scenario or three-cluster threshold. Promoted 82T411 to the Product Plan epic; child features inherit its approved jobs, milestones, success threshold, non-goals, and Killer Demo by contract digest.
