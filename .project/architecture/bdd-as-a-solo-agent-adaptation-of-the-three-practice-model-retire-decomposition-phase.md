# BDD as a Solo-Agent Adaptation of the Three-Practice Model (retire `decomposition` phase)

**Status:** Accepted — planning-beat placement superseded by [plan-implementation: a gated planning phase](plan-implementation-a-gated-planning-phase-as-the-automation-on-ramp.md) (2026-07-09); the solo-agent adaptation rationale stands
**Date:** 2026-06-02

**What.** Safeword’s `bdd` workflow adapts BDD’s Discovery, Formulation, and Automation practices to a **single agent + one human**. The agent plays all three "Three Amigos" roles. Safeword retired the separate `decomposition` phase. At `scenario-gate` exit, the agent assigns each scenario a test layer and sets the build order. In `intake`, it identifies components and decides when design documents or ADRs are needed.

**Why.** Canonical BDD has no breakdown phase. Safeword’s extra phase had no gate or required artifact to reveal when agents skipped it. A chain audit (epic EECVXB) found that ~75% of the work duplicated intake’s architecture step. At the time of retirement, `intake` covered Discovery, `define-behavior` and `scenario-gate` covered Formulation, and `implement` and `verify` covered Automation.

**Trade-off.** Safeword follows the BDD steps more consistently than a human team through enforced ordering, traceable artifacts, and an adversarial review on every run. One model can still miss the same error in all three roles. Self-review is weaker than review by people or agents with independent judgment.

**Alternatives.** Removing `decomposition` immediately would have affected the phase enum, hooks, paired Cursor rule, `schema.ts`, parity fixture, tests, and a live ticket still in that phase. Safeword staged removal instead. Keeping the phase optional would have preserved the duplicate work.

**Implementation.** Reversible step (FSX1PP): `scenario-gate` exit (`SCENARIOS.md`) absorbs test-layer assignment + sequencing; `SKILL.md` + `lib/quality.ts` mark `decomposition` deprecated; `scenario-gate` advances straight to `implement`. W9GPE7 completed removal on 2026-06-02. It dropped the enum value from `BddPhase`/`PHASE_EVIDENCE` and the hook phase-lists, deleted `DECOMPOSITION.md` + the Cursor rule `bdd-decomposition.mdc` (both copies), removed the `schema.ts`/parity-fixture refs and the skill/doc phase-table rows; ticket `153-boundary-resilience` reached `done`. Historical retirement-rationale prose citing this ADR is kept in `DISCOVERY.md`/`SCENARIOS.md`. Decision via `/figure-it-out` 2026-06-02.
