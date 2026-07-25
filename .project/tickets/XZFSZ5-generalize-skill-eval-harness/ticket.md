---
id: XZFSZ5
slug: generalize-skill-eval-harness
type: task
phase: implement
status: in_progress
parent: 7ZLTWB
depends_on: [21RAT9]
scope:
  - The METHODOLOGY as a durable, copyable asset — a playbook documenting the eval-driven discipline (eval-first; GEPA-optional; single-run adjudication is unreliable → multi-run consensus; relative recall FLOOR over baseline-reliable items, no composite headline; bare-model oversells → Tier-2 real-harness gate; never auto-adopt).
  - review-spec's experiment (experiments/gepa-review-spec) as the REFERENCE IMPLEMENTATION a new seeded-corpus skill copies and adapts — concrete, with documented entry points, not prose.
  - Extract shared CODE only at the THIRD seeded-corpus consumer (rule of three), and only the genuinely corpus-agnostic pieces (the Tier-2 `claude -p` runner shell is the first candidate).
out_of_scope:
  - Building a shared floor/consensus/scoring FRAMEWORK now — /figure-it-out 2026-07-24 (work log): at N=2 semantically-divergent evals that is the wrong abstraction. The floor's value is per-SEED (anti-gaming); it has no meaning on a corpus with no seeded item set, and genericizing it to aggregate-score regression degrades review-spec while misfitting pr-review.
  - CWGYH0 as a harness consumer — pr-review's eval is a DIFFERENT shape (real human-approved-zero-comment PRs + human triage + a pre-registered bar, no seeding). It reuses the DISCIPLINE, not the seeded harness code.
  - Building the pr-review corpus (CWGYH0's job). Re-optimizing review-spec (done in 21RAT9).
done_when:
  - A methodology playbook exists so a new skill onboards to the eval discipline without re-deriving the floor/consensus/Tier-2 design.
  - review-spec's experiment is usable as a copyable reference implementation (documented entry points, not just source).
  - The extraction trigger is recorded — at the third seeded-corpus skill, extract the shared seeded-gate then, not before.
created: 2026-07-24T04:13:44.000Z
last_modified: 2026-07-24T17:57:01.000Z
---

# Generalize the eval discipline for any skill — playbook + reference impl, not a premature framework

**Goal:** Make the eval-driven-skill-optimization method reusable so any skill's prompt changes can be adjudicated by evidence — by capturing the METHODOLOGY (a playbook) and a copyable REFERENCE IMPLEMENTATION (review-spec's experiment), not by building a shared code framework two divergent evals would both fight.

**Why this shape (reframed 2026-07-24, /figure-it-out):** the epic first assumed "parameterize the seeded harness so pr-review consumes it." But CWGYH0 (pr-review's eval) chose real-PR + human-triage, not seeding — a semantically different eval. The reusable asset across both is the DISCIPLINE, not the seeded floor/consensus code (whose per-seed anti-gaming value is intrinsically seeded-corpus-specific). Rule of three: extract shared code at the third seeded consumer, not the second. Duplication is cheaper than the wrong abstraction.

**Riskiest assumption:** a documented playbook is enough to keep a future seeded-corpus skill from re-deriving (and drifting on) the floor/consensus lessons. Cheapest mitigation: ship review-spec's experiment as a concrete copyable reference with documented entry points, plus the explicit extract-at-three trigger.

## Work Log

- 2026-07-24 Created. The reusable-harness half of the eval-driven-skill-optimization epic. First consumer: pr-review (WAWQA6/CWGYH0).
- 2026-07-24 **Reframed via /figure-it-out (B: playbook + reference impl, not a shared framework).** Evidence: eval frameworks (Braintrust/promptfoo) keep the regression gate at the abstract-score layer — exactly the layer where our per-SEED floor gives up its anti-gaming value; and rule-of-three / "duplication is cheaper than the wrong abstraction" (Metz) warns against abstracting N=2 semantically-divergent consumers. CWGYH0 uses real-PR + human-triage (no seeded set), so the floor/consensus has nothing to protect there — it is NOT a consumer of a shared seeded harness. Rewrote scope/done_when: deliver the methodology playbook + review-spec as a copyable reference impl; extract shared code only at the THIRD seeded-corpus skill (the Tier-2 runner the first candidate). Supersedes the original "parameterize the harness, zero review-spec-specific code" goal.
- 2026-07-24T18:15:16.583Z Phase: intake → implement
