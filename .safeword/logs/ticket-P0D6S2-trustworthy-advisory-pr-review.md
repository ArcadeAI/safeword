# Work Log: Route every ready PR with one trustworthy advisory review

**Anchored to:** `.project/tickets/P0D6S2-trustworthy-advisory-pr-review/ticket.md`

---

## Session: 2026-08-04

- [14:09] Adopted GitHub issue #1909 as local feature ticket P0D6S2 on a dedicated branch from current `main`.
- [14:10] Read parent epic #1908, issue #1909, draft PR #1917, and the preserved live-spike report. Kept the false fix-verification claim as a release blocker.
- [14:11] Intake decision: treat the user's explicit “proceed” plus the already-written issue contract as confirmation of the JTBD, Rule, and scope gates. Draft PR #1917 supplies implementation evidence only; it is not merged and does not define the product contract where it conflicts.
- [14:11] Evidence gaps carried into behavior: #1917 currently exposes `reviewed` rather than `looks ready`, lacks distinct incomplete/stale/failed publication states, and renders verified-fix language from a fix field whose provenance must be runner-controlled.
- [14:18] Derived 10 behavioral dimensions before scenarios. Authored 8 numbered Rules and 20 observable scenario entries (including three Scenario Outlines) across eligibility, unfamiliar artifacts, routing, freshness, evidence integrity, plain-language publication, and fork authority.
- [14:20] Validation: Gherkin lint healthy; all authored Markdown passes Prettier; repository status reports no P0D6S2 lineage or surface issue. Existing status failures are unrelated project drift (missing Go/Python packs and older ticket advisories).
- [14:21] Tier-1 spec self-review passed against freshly resolved principles, personas, and surfaces. All JTBD personas resolve, every job has product-level numbered Rules, Safeword CLI resolves as a configured surface, GitHub PR review is explicitly spec-local, and the Rules stay within #1909's advisory boundary.
- [14:29] Independent cross-agent quality review requested changes: explicitly route incomplete/failed/stale runs, add deterministic unfamiliar-artifact delivery proof, and define all-inert change behavior. Applied all findings and removed the misleading `@rejection` tag from the live `.flux` success case.
- [14:29] Current GitHub security/checks documentation exposed an additional authority boundary: a neutral check can still participate in repository merge policy. Added SWM1.R2 so the advisory receipt cannot approve or satisfy a required check; #1917's “non-required” comment is not sufficient enforcement.
- [14:36] Second independent pass found the material/immaterial freshness boundary and resolved-finding complement were still implicit. Defined material update semantically (never by extension), added an immaterial freshness bridge and resolved-finding removal, pinned the receipt to a non-review conversation comment, and added a deterministic prompt-injection routing guard.
- [14:43] Third cross-agent quality review APPROVED with no blocking findings. Deferred informational planning notes: keep the live `.flux` evaluation lane distinct from deterministic CI; make same-repo controlled execution mapping intentional; and require a conservative deterministic materiality signal before reusing a prior conclusion.
- [15:02] Applied all three approval notes: marked the `.flux` case as an explicitly selected live-model evaluation outside deterministic CI; made uncertain materiality invalidate the prior conclusion and force a fresh review; and added SWM1.R3 so same-repository execution requires a named evidence purpose with command, revision, outcome, and resolved unknown recorded.
- [15:10] Follow-up review found failed-run telemetry ambiguous. Defined terminal attempts, added partial-on-failure telemetry, aligned fork scope to the actual no-execution-under-write-authority invariant, made deterministic `.flux` surrogates the CI gate, gave all-inert changes a non-routing receipt, and added concurrent-trigger coalescing.
- [15:17] Cross-agent re-review APPROVED the revised packet with no blocking findings. Informational implementation-plan notes remain for immediate stale publication after a material push, non-approving inline-comment mechanics, and a direct unfamiliar-artifact-to-human surrogate binding.
- [15:22] User confirmed scenario completeness. Advanced to scenario-gate and anchored `features/trustworthy-advisory-pr-review.feature`; implementation planning remains blocked on the formal review-spec gate.
- [16:55] Formal review-spec scenario gate APPROVED independently by Claude (cross-agent). Recorded the scenario-gate stamp and advanced to plan-implementation. No spike offered: the two cautions are proof-plan concerns, not build-only kill-risks—use explicit forbidden-action observation sentinels and a serialized injected trigger-claim primitive.

## Session: 2026-08-05

- [14:38] User accepted a phased delivery at the plan-implementation split checkpoint. Promoted P0D6S2 to an epic and created HXT3GW (advisory-only MVP), Z7M7Y3 (freshness/noise), and 436EQW (controlled execution).
- [14:45] MVP cut: one fresh review per SHA, all changed text including unfamiliar artifacts, one ordinary receipt, strict conservative routes, no checkout, no customer-code execution, no inline review API, no materiality classifier, and no positive remedy-verification state.
- [14:49] Replaced the 33-entry monolithic feature with three bounded feature sources. All three parse and lint cleanly; ticket lineage/surface checks report no scoped findings after fixes.
- [14:52] Authored HXT3GW design and six-slice plan. Revised the proposed architecture decision to record phased privilege expansion instead of shipping controlled execution in the MVP.
- [14:53] Independent plan gate exhausted: preferred Claude timed out; fallback returned invalid output. No stamp and no phase advance. Recovery: `bun packages/cli/src/cli.ts review run plan-implementation .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/impl-plan.md .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/design.md .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/spec.md .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/ticket.md features/route-ready-prs-with-a-safe-advisory-review.feature PRINCIPLES.md .project/personas.md .project/surfaces.md ARCHITECTURE.md --no-input --json`.
