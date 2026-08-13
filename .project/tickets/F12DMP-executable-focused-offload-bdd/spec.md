# Spec: Turn offload specifications into trustworthy executable coverage

<!-- safeword:inspiration-contract:v1 -->

## Intent

Make the offload BDD corpus tell the truth about what is executable. Make its
scenarios readable, identify meta-proofs explicitly, and prevent prose-only
Rules from being mistaken for acceptance coverage.

## Intake Brief

- **Requested by:** Alex Salazar during the review of PR #2596
- **Cost of inaction:** A preserved specification can look like green BDD coverage while Cucumber executes none of its 624 examples.
- **Reversibility:** Two-way door; delivery tags, bindings, and readability policy can evolve Rule by Rule.

## References

- GitHub issue #2583 and merged PR #2596 split the original monolith without changing its behavior inventory.
- GitHub issue #2624 tracks this executable-coverage follow-up.
- Cucumber's official anti-pattern guidance recommends atomic steps and warns against conjunction steps.

## Personas

- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Safeword CLI

Unaffected:

- GitHub Actions Execution Sandbox — remote dispatch and workflow execution remain out of scope.

## Vocabulary

skip: no new domain terms

## Product Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |
| --- | --- | --- | --- | --- | --- | --- |
| https://cucumber.io/docs/guides/anti-patterns/ | 2026-08-11 | Cucumber documentation updated 2026-06-22 | Atomic steps remain reusable and produce narrower failures | Split conjunction-heavy outcomes into independently asserted observable steps | Do not split a cohesive domain precondition merely to satisfy a character count | Apply the policy to delivered scenarios and enforce it prospectively across the corpus |

## Jobs To Be Done

### executable-offload-bdd.SWM1 — Trust what the BDD lane claims

**Persona:** Safeword Maintainer (SWM)

> When I review offload BDD coverage, I want delivered Rules to require real
> bindings and unfinished Rules to remain explicit, so green CI cannot mean zero
> scenarios ran.

#### executable-offload-bdd.SWM1.R1 — Every delivered offload Rule enters the executable Cucumber lane and every undelivered Rule remains marked work in progress

#### executable-offload-bdd.SWM1.R2 — Delivered scenario steps are atomic enough to identify one failing observation

## Rave Moment

skip: table-stakes

## Outcomes

- Removing `@wip` from an offload Rule without entering the executable proof lane fails public Gherkin lint.
- Undefined steps still fail Cucumber when a Rule legitimately enters that lane.
- Harness-completeness scenarios are explicitly classified as intended Vitest proofs without claiming completed proof.
- New run-on offload steps fail a focused readability guard with their file and line.

## Open Questions

defer: Which remote Rule should be implemented second belongs to a later independently scoped ticket.
