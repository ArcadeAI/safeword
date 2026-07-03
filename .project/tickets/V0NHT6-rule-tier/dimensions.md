# Dimensions: Numbered Rule tier (V0NHT6)

Derived from scope / done_when / decisions plus domain knowledge of the existing
lineage machinery (`gherkin-feature.ts`, `scenario-coverage.ts`, `jtbd.ts`).

| Dimension                              | Partitions                                                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spec JTBD criterion kind               | AC-only · R-only · mixed AC+R · neither (no criteria, no skip) · `skip:` line                                                                                           |
| Feature-file lineage tag kind/placement | R tag on `Rule:` block (inherited) · R tag directly on scenario · AC tag (flat lineage) · no lineage tag · multiple lineage refs after inheritance                       |
| Ref-grammar overlap                    | tag ending `.AC<n>` after an `R<n>`-shaped segment (`@feat.R1.AC1`) — AC-match wins · plain R ref (terminal)                                                            |
| Rule ID ↔ spec-catalog drift           | matching spec rule · stale (JTBD exists, R# doesn't) · orphan (JTBD absent) · uncovered (spec rule with zero referencing scenarios)                                     |
| Rejection-path coverage                | numbered Rule with ≥1 `@rejection` scenario · numbered Rule with zero · unnumbered `Rule:` block (exempt)                                                               |
| Name-token ↔ tag correspondence        | name first-token matches block tag · mismatch · unnumbered name with no R tag (legacy, exempt)                                                                          |
| Intake-exit gate outcome               | R-only JTBD passes · neither-kind JTBD denied with message naming Rules                                                                                                  |
| Backward compatibility                 | repo with zero R headings/tags — check output byte-identical, existing fixtures untouched                                                                                |

Boundary notes: 1-indexed `R<n>` per JTBD (R1 boundary); AC-wins precedence is the
grammar-overlap boundary; unnumbered `Rule:` blocks are the exempt class throughout.
