# Spec: Gherkin `.feature` Files Become the Scenario Source of Truth

## Intent

Make Safeword's behavior source the same artifact the acceptance lane executes:
Gherkin `.feature` files. `test-definitions.md` remains the TDD progress ledger
because hooks enforce R/G/R from its checkboxes.

## References

- Ticket 102a: `codify --format gherkin` and safeword's package Cucumber lane.
- Ticket 102b: customer setup scaffolds `features/`, `steps/`, `cucumber.mjs`, and `test:bdd`.
- Cucumber Gherkin reference: `Rule` groups scenarios and a `.feature` file has one `Feature`.
- Cucumber API reference: tags can be placed on Feature, Rule, Scenario, Scenario Outline, and Examples.
- `@cucumber/gherkin` README: in-process library parsing is the preferred way to consume AST/pickles.

## Personas

- Safeword Maintainer (SM)
- Technical Builder (TB)

## Vocabulary

- **Feature source:** The `.feature` file that carries executable Gherkin scenarios.
- **Ledger:** `test-definitions.md`, reduced to scenario names plus RED/GREEN/REFACTOR checkboxes for hook enforcement.
- **Lineage tag:** A Gherkin tag shaped `@<jtbd-id>.AC<#>` used to map scenarios back to `spec.md` acceptance criteria.

## Jobs To Be Done

### feature-files-as-source.SM1 - Keep behavior executable at the source

**Persona:** Safeword Maintainer (SM)

> When I maintain Safeword's BDD flow, I want agents and CLI checks to read the
> same `.feature` files that Cucumber executes, so I can remove markdown/Gherkin
> drift without losing hook-enforced TDD progress.

#### feature-files-as-source.SM1.AC1 - Coverage reads lineage from Gherkin tags

`safeword check` maps `@<jtbd>.AC#` tags in feature files to `spec.md`
acceptance criteria and reports uncovered, stale, and orphan references.

#### feature-files-as-source.SM1.AC2 - Codify derives implementation stubs from feature source

When a ticket has a matching feature source, `safeword codify` emits derived
Vitest skeletons from the `.feature` file instead of requiring markdown
scenarios.

#### feature-files-as-source.SM1.AC3 - Authoring and review instructions point to one behavior source

BDD, review-spec, planning, and test-definition templates direct agents to
write/review `.feature` scenarios and keep `test-definitions.md` as the R/G/R
ledger.

#### feature-files-as-source.SM1.AC4 - Existing markdown tickets continue working

Tickets without a matching `.feature` source keep using the existing
`test-definitions.md` parser for coverage and codify until they migrate.

## Outcomes

- New BDD work creates executable Gherkin first, so `test:bdd` has meaningful
  feature input instead of a derived copy.
- Coverage advisories follow the same lineage scheme from feature tags that
  scenario titles previously carried.
- Existing tickets and hook gates continue to work during migration.

## Open Questions

defer: Full removal/deprecation timing for markdown scenario authoring belongs
to the follow-up migration once active tickets have feature sources.
