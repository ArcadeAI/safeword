---
id: MR5M3A
slug: architecture-gate
type: feature
phase: done
status: done
created: 2026-06-12T01:36:37.466Z
last_modified: 2026-06-12T20:59:00.000Z
scope:
  - Require the impl-plan.md Decisions section (shipped by #204) to carry cited external evidence — the enforceable trace that /figure-it-out ran — for new-flow features; this is the generation half of "propose with evidence, then independently challenge"
  - Add a fresh-context fork review of the impl-plan.md design, adversarial (refute the design against its cited sources), whose pass is required to leave the implement phase — reusing the Tier 2 review-ledger/stamp mechanism; this is the selection half
  - Record the reviewing model on the design-review stamp, and add an optional config knob to require the review be performed by a different model than the author — same-model fork is the default floor, cross-model is the opt-in ceiling-raiser (the one lever the research says lifts correlated-error ceiling)
  - Build on #204's impl-plan.ts + architecture-records.ts rather than introducing a parallel artifact
  - Provide an auditable `skip: <reason>` escape valve for both the evidence requirement and the review
  - Ship default-off behind a config flag (mirror `reviewGate`), enforcing only when explicitly enabled
out_of_scope:
  - The impl-plan.md artifact, its existence gate, ADR consultation, and reconciliation (delivered by #204 / epic M6D315 — this builds on top, does not rebuild)
  - Features-only scoping and grandfathering (inherited from #204's spec.md-routed flow, not re-implemented)
  - Gating patches or tasks
  - A voting panel / multi-agent ensemble reviewer (research shows the "popularity trap" underperforms a single adversarial reviewer)
  - Auto-judging architecture quality in a hook (hooks enforce presence of evidence + a review stamp; quality comes from the cited generation and the independent challenge)
  - Verifying the reviewing model's self-reported identity (the model tag is honor-system, same trust boundary as the stamp itself — out of scope to cryptographically attest)
  - Reviving the retired standalone decomposition phase
done_when:
  - With the flag enabled, a new-flow feature cannot leave implement without (a) an impl-plan.md Decisions section carrying >=1 cited source and (b) a matching fork-review stamp for the design — or an auditable skip for either
  - With cross-model review configured, a design-review stamp whose recorded model equals the author's does not satisfy the gate
  - Patches and tasks are never blocked by this gate
  - With the flag off, behavior is identical to post-#204 (gate inert)
  - The full suite passes (targeted hook/gate tests + smoke)
depends_on:
  - '#204 (epic M6D315) must merge first — this layers on its impl-plan.md + architecture-records.ts'
---

# Independent evidence-backed architecture gate for features

**Goal:** Layer the missing independent challenge onto #204's impl-plan: require the design to be generated from cited evidence (the /figure-it-out trace) and then survive a fresh-context adversarial review before implementation completes — the one defense against correlated single-agent errors that #204 leaves out.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-12T01:36:37.466Z Started: Created ticket MR5M3A
- 2026-06-12T02:24:00.000Z Complete: define-behavior - 15 scenarios across 5 rules (evidence, design-review stamp, cross-model, default-off, scope exemptions)
- 2026-06-12T02:30:00.000Z Complete: scenario-gate - two independent fork reviews (3 must-fix + 4 should-strengthen found and fixed; verify pass 0 must-fix); 25 scenarios, AODI clean; impl-plan.md written (status planned)
- 2026-06-12T20:59:00.000Z Done: shipped in PR #208 (squash 430dd15). Full CI green; an independent implementation review caught a fail-open + cross-model ordering bug, both fixed. Gate recorded as an ADR in ARCHITECTURE.md. Closed via cleanup branch (the done-gate's full-suite run was not tractable in the build sandbox).
