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

<!-- None declared — `.safeword-project/personas.md` is not bootstrapped. -->

## Vocabulary

<!-- "Acceptance Criterion (AC)" is defined for the product domain in this feature; project-wide glossary curation is separate. -->

## Jobs To Be Done

skip: Internal dev-workflow tooling — 31W8M3 adds a Phase-0 authoring step and
gate to safeword itself, not a product feature with external personas. The
repo's persona model (`.safeword-project/personas.md`) isn't bootstrapped.
(Uses the Y2HCNJ gate's skip valve, as SW1SE5/SXSCJQ did.)
