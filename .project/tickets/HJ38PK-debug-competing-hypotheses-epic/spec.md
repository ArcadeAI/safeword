# Spec: Debug skill — competing hypotheses + disconfirm-first (ACH)

## Intent

Make `debug`'s investigation hold 2–3 competing hypotheses and rule them out by the cheapest disconfirming test, instead of forming and chasing a single hypothesis. It matters because single-hypothesis fixation invites confirmation bias, and structured competing-hypothesis approaches are well-supported in controlled studies (the strongest effect sizes come from tool support, so we adopt the strategy and don't claim the tool's exact numbers).

## References

- Parent: [B6MZ4Z — reasoning-skills uplift](../B6MZ4Z-review-refactor-uplift-epic/ticket.md) (shared evidence record + the find→verify/disconfirm spine)
- [Hypothesizer (ACM UIST 2023)](https://dl.acm.org/doi/10.1145/3586183.3606781) — RCT of the _tool_ (n=16 pro devs): ~5× fix success, ~3× faster vs. traditional debugging (magnitude is tool-mediated)
- [Using Hypotheses as a Debugging Aid (arXiv:2005.13652)](https://arxiv.org/pdf/2005.13652) — offering candidate hypotheses made devs ~6× likelier to succeed
- [Consider-the-opposite / alternative-hypotheses debiasing](https://www.sciencedirect.com/topics/psychology/confirmation-bias) (Lord et al. 1984) + [task-structure study, 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11169332/) — considering alternatives reduces confirmation bias; diagnostic (disconfirming) > pseudodiagnostic (confirm-only) testing. **This is the load-bearing support.**
- [Analysis of Competing Hypotheses (ACH)](https://sosintel.co.uk/mastering-the-analysis-of-competing-hypotheses-ach-a-practical-framework-for-clear-thinking/) — we borrow the _stance_ (competing hypotheses + disconfirmation). Its formal scoring **matrix**'s bias-reduction is contested ([Dhami 2019](https://onlinelibrary.wiley.com/doi/full/10.1002/acp.3550)); we do **not** prescribe the matrix.
- [AI bug-localization with competing hypotheses](https://arxiv.org/pdf/2601.12522)

## Personas

Descriptive at intake (formal persona codes assigned at define-behavior):

- **Engineer debugging under pressure** — the conditions the skill flags as guess-prone; wants a method that beats first-hypothesis fixation.

## Vocabulary

- **Competing hypotheses** — 2–3 candidate root causes held at once, ranked by plausibility/impact.
- **Disconfirming test** — the cheapest check that would _rule a hypothesis out_ (ACH), preferred over a confirming one.

## Jobs To Be Done

### debug-competing-hypotheses.engineer1 — Don't lock onto the first theory

> When I'm debugging a failure, I want to weigh a few competing causes and rule them out by evidence, so I don't burn time confirming a wrong favorite.

## Outcomes

- Investigations routinely name ≥2 candidate causes before testing.
- The first test run is a disconfirming/elimination one, not a confirmation of the favorite.
- Ruled-out hypotheses (and why) are recorded, so a stalled session can be picked up without re-walking dead ends.

## Open Questions

- defer: persona codes + acceptance criteria → define-behavior.
- defer: whether D2 (logging eliminated hypotheses) reuses the existing "Root Cause" checkpoint section or adds a sibling — decide at implementation.
