---
id: MR5M3A
slug: architecture-gate
type: feature
phase: intake
status: in_progress
created: 2026-06-12T01:36:37.466Z
last_modified: 2026-06-12T01:36:37.466Z
scope:
  - Require the impl-plan.md Decisions section (shipped by #204) to carry cited external evidence — the enforceable trace that /figure-it-out ran — for new-flow features; this is the generation half of "propose with evidence, then independently challenge"
  - Add a fresh-context fork review of the impl-plan.md design, adversarial (refute the design against its cited sources), whose pass is required to leave the implement phase — reusing the Tier 2 review-ledger/stamp mechanism; this is the selection half
  - Build on #204's impl-plan.ts + architecture-records.ts rather than introducing a parallel artifact
  - Provide an auditable `skip: <reason>` escape valve for both the evidence requirement and the review
  - Ship default-off behind a config flag (mirror `reviewGate`), enforcing only when explicitly enabled
out_of_scope:
  - The impl-plan.md artifact, its existence gate, ADR consultation, and reconciliation (delivered by #204 / epic M6D315 — this builds on top, does not rebuild)
  - Features-only scoping and grandfathering (inherited from #204's spec.md-routed flow, not re-implemented)
  - Gating patches or tasks
  - A voting panel / multi-agent ensemble reviewer (research shows the "popularity trap" underperforms a single adversarial reviewer)
  - Auto-judging architecture quality in a hook (hooks enforce presence of evidence + a review stamp; quality comes from the cited generation and the independent challenge)
  - Reviving the retired standalone decomposition phase
done_when:
  - With the flag enabled, a new-flow feature cannot leave implement without (a) an impl-plan.md Decisions section carrying >=1 cited source and (b) a matching fork-review stamp for the design — or an auditable skip for either
  - Patches and tasks are never blocked by this gate
  - With the flag off, behavior is identical to post-#204 (gate inert)
  - The full suite passes (targeted hook/gate tests + smoke)
depends_on:
  - "#204 (epic M6D315) must merge first — this layers on its impl-plan.md + architecture-records.ts"
---

# Independent evidence-backed architecture gate for features

**Goal:** Layer the missing independent challenge onto #204's impl-plan: require the design to be generated from cited evidence (the /figure-it-out trace) and then survive a fresh-context adversarial review before implementation completes — the one defense against correlated single-agent errors that #204 leaves out.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-12T01:36:37.466Z Started: Created ticket MR5M3A
