---
id: XZFSZ5
slug: generalize-skill-eval-harness
type: feature
phase: intake
status: intake
parent: 7ZLTWB
depends_on: [21RAT9]
scope:
  - Parameterize the experiments/gepa-review-spec harness (dataset/task/evaluator/protected/validate-skill/stability + the multi-run consensus gate + the Tier-2 claude -p runner) so it drives ANY skill - skill path, corpus dir, fixtures, and protected manifest are inputs, not review-spec constants.
  - Lift the reusable seams out of the review-spec experiment into a shared location a second skill can consume.
  - First application - the pr-review skill (WAWQA6/G5337S), giving CWGYH0 the same floor + consensus + Tier-2 rigor review-spec got.
  - Document the onboarding path so a new skill gets an eval without re-deriving the design.
out_of_scope:
  - Building the pr-review corpus itself - that is CWGYH0's job; this ticket provides the harness it plugs into.
  - Re-optimizing review-spec - done in 21RAT9.
done_when:
  - The harness scores a second skill (pr-review) with zero review-spec-specific code.
  - The floor/consensus/Tier-2 machinery is shared, not copy-pasted per skill.
  - A short onboarding doc lets a new skill be added as configuration.
created: 2026-07-24T04:13:44.000Z
last_modified: 2026-07-24T04:13:44.000Z
---

# Generalize the skill-eval + consensus-gate + Tier-2 harness for any skill

**Goal:** Turn the review-spec-specific eval machinery into a skill-agnostic harness so any skill's prompt changes can be adjudicated the same way — corpus, skill, fixtures, and protected manifest as parameters.

**Why now:** review-spec proved the pipeline end-to-end (21RAT9). The next skill in line — pr-review (CWGYH0 already wants an eval) — should reuse it, not reinvent it.

**Riskiest assumption:** the seams (dataset/task/evaluator/protected/gate/Tier-2) are already clean enough to parameterize without a rewrite. Cheapest test: point the existing `validate-skill` gate at a pr-review corpus with only config changes and see what breaks.

## Work Log

- 2026-07-24 Created. The reusable-harness half of the eval-driven-skill-optimization epic. First consumer: pr-review (WAWQA6/CWGYH0).
