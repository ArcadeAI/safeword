# Spec: Add Acceptance Criteria layer between JTBD and scenarios

## Intent

Safeword's `bdd` Phase 0 now captures personas (7YN5QB), a glossary (YR6C49),
and JTBDs (Y2HCNJ), then jumps straight from engineering scope/done-when to
Phase-3 scenarios. When done-when is coarse, scenarios become unclear about what
they prove. This feature inserts the **Acceptance Criteria** rung between JTBDs
and scenarios: each AC is a single capability/guarantee under a JTBD, each
Phase-3 scenario proves a specific AC, and the ACs sum to JTBD fulfillment. It is
the fourth and final product-framing artifact the DZ2NM5 epic set out to merge.

## References

- Parent epic: DZ2NM5 (bdd Phase-0 merge); arcade pair T9BNXD.
- Depends on Y2HCNJ (JTBD) — shipped 2026-05-28; AC nests under its `### <slug>.<persona-code><n>` JTBD headings in spec.md.
- Gate/skip-valve precedent: `hooks/lib/jtbd.ts` (`parseJtbdSection` + `evaluateJtbdGate`) and the dimensions `skip:` valve (MKVNFB).
- Numbering extends downward to scenarios in XT1FFM (out of scope here).

## Personas

**Technical Builder (TB)** — primary beneficiary; gets purposeful,
design-validated scenario coverage from the AC rung. **Safeword Maintainer (SM)**
is the dogfooding subset, exercising this very layer when building safeword.

## Vocabulary

**Acceptance Criterion (AC)** — a single capability or guarantee a persona gets,
stated in observable product language; the rung between a JTBD and the scenarios
that prove it. (Project-wide `glossary.md` is not yet bootstrapped.)

## Jobs To Be Done

### ac-layer.DEV1 — Trust that scenarios prove the feature, not just that code runs

**Persona:** Technical Builder (TB)

> When I have my agent build a feature, I want each job's required capabilities
> pinned as acceptance criteria before any scenarios are written, so I can trust
> the scenarios prove the feature does its job — not merely that some code runs.

#### ac-layer.DEV1.AC1 — Each job carries ≥1 acceptance criterion (or an auditable skip) before scenarios can be written

#### ac-layer.DEV1.AC2 — Each scenario proves a specific acceptance criterion, so scenario coverage is provably purposeful

## Outcomes

- A feature's spec.md has ≥1 AC under every JTBD (or a reasoned `skip:`), and the intake-exit gate enforces it before test-definitions.md can be created.
- Phase-3 scenarios each trace to a parent AC — no orphan scenarios, no AC without coverage.
