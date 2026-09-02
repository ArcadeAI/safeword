---
name: demand-research
description: Tests whether a proposed product bet has credible demand. Use when
  Why now depends on an unresolved, decision-critical demand claim or when the
  user explicitly asks for demand research. Do NOT use for child features,
  mandated work, parity work, or when a cheaper experiment can answer the
  question before research.
allowed-tools: '*'
---

# Demand Research

Answer one question: **is there enough credible demand evidence to make this
product bet now?** Keep the result small enough to paste into Product Bet.

## First decide whether research earns its cost

Skip research when any applies:

- The ticket is a child contribution; inherit the epic's demand case.
- The work is mandated, compliance-driven, or parity work.
- A cheap reversible experiment can test the assumption more directly.
- The demand claim would not change scope, priority, or the build/no-build call.

When skipping, state the reason in one sentence. Do not manufacture a research
appendix to make the plan look complete.

## Research loop

1. Frame the single decision and the demand claim that could change it.
2. Start with first-party evidence: customer requests, usage, sales/support
   records, interviews, or the user's supplied material.
3. Fill only meaningful gaps with current external sources. Prefer primary
   sources and record the date checked.
4. Grade evidence by sacrifice: behavior, money, time, or switching cost beats
   stated interest. Separate direct evidence from inference.
5. Run a skeptic pass: name the strongest alternative explanation and whether
   the evidence survives it.
6. Stop when the decision can be made or the cheapest next validation is clear.

## Output

Return exactly these four compact parts:

- **Verdict — PRESENT, WEAK, ABSENT, or UNAVAILABLE:** one sentence tied to the
  decision, not a market-size claim.
- **Strongest evidence:** up to three dated bullets with links or local evidence
  identities; label inferences.
- **Gaps:** only unknowns that could reverse the verdict.
- **Cheapest validation:** one concrete next test, or `none` when evidence is
  already sufficient.

`ABSENT` and `UNAVAILABLE` are evidence states, not approval blockers. Do not
invent evidence or upgrade demand strength when sources are unavailable.

Update **Problem / Why now** with the verdict and strongest decision-bearing
evidence. Do not add a separate research document unless the evidence itself is
too large to cite compactly.
