---
description: Red-teams a ticket's test scenarios for gaps — cases that would pass even though the feature is broken (project)
---

# Review Spec

Red-team the active ticket's `test-definitions.md` scenarios: "what breaks that these don't catch?" Run the full Scenario Quality Gate:

- Vacuous-pass check (a scenario that would still pass against a broken build)
- AODI check (each scenario is Atomic, Observable, Deterministic, Independent)
- Determinism risks
- An adversarial pass plus negative cases
- Cross-cutting checks

Report as: a tally, then findings grouped into severity tiers, one `####` block per finding with Current → Proposed → **Next:**.

The full procedure lives in the `review-spec` skill (`.safeword/skills/review-spec/SKILL.md`). Auto-fired by the bdd scenario-gate; re-invokable after scenario edits. Not a `spec.md` framing review — that is self-review.
