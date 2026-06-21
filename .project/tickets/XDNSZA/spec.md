# Spec: Impl plan as first-class artifact

## Intent

Give feature work an upfront design record — what approach was chosen, what alternatives were rejected, where it aligns with or deviates from architecture, and what would prompt revisiting — written before code and kept honest by hooks. Absorbed from arcade's `/implement-spec` (epic M6D315).

## References

- Epic [M6D315](../M6D315/ticket.md) — replan 2026-06-10 (storage shape, authoring point, build order)
- Arcade `/implement-spec` SKILL.md — source discipline being absorbed
- VYRKBJ (cancelled) — skip-annotation scope folded in here
- Design Docs at Google — plan-drift practice grounding the lifecycle

## Personas

- Technical Builder (TB)
- Safeword Maintainer (SM)

## Vocabulary

- **Impl plan** — the per-ticket `impl-plan.md` sibling artifact (Approach / Decisions / Arch alignment / Known deviations / Assessment triggers, `**Status:** planned|implemented`).

## Jobs To Be Done

### impl-plan-artifact.DEV1 — Know why the implementation looks the way it does

**Persona:** Technical Builder (TB)

> When I revisit a feature my agent built weeks ago, I want the chosen approach, the rejected alternatives, and the known deviations recorded next to the ticket, so I can tell intentional design from accident without re-deriving it.

#### impl-plan-artifact.DEV1.AC1 — A feature entering implementation carries an impl plan with all five sections accounted for

#### impl-plan-artifact.DEV1.AC2 — A section that doesn't apply carries an auditable skip reason instead of silence

### impl-plan-artifact.SM1 — Enforce the plan without trusting agent claims

**Persona:** Safeword Maintainer (SM)

> When I ship the impl-plan discipline, I want hooks to validate the artifact's presence, sections, and status machine-side, so I can trust the record exists rather than relying on the agent saying it wrote one.

#### impl-plan-artifact.SM1.AC1 — The stop gate blocks new-flow features at implement/done without a valid impl plan, and exempts tasks and grandfathered tickets

#### impl-plan-artifact.SM1.AC2 — The parser reports the status lifecycle and per-section content-or-skip verdicts with named-section errors

## Outcomes

- Feature tickets created after this ships carry an `impl-plan.md` from scenario-gate exit onward; reviewers find decisions and deviations in one predictable place.
- Skill docs (canonical + dogfood) teach the authoring step; the template scaffolds it.

## Open Questions

defer: ERVA6V owns the implemented-status exit gate; K4BWTQ owns Arch-alignment population — both sequenced next in the epic.
