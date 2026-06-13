# Dimensions: Feature Files as Source

| Dimension             | Partitions                                                                             | Boundary / Notes                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Scenario source       | `.feature` present; legacy `test-definitions.md` only                                  | Feature source wins when present. Legacy markdown remains a fallback for older tickets.                                       |
| Lineage location      | Scenario tag; Rule/Feature inherited tag; missing/free-text tag; stale/orphan tag      | Coverage should parse `@<jtbd>.AC#` tags through the official Gherkin parser and classify refs against `spec.md`.             |
| Progress ledger       | Ledger-only `test-definitions.md`; legacy full markdown scenarios                      | R/G/R hooks only need scenario headings and checkboxes, so Given/When/Then can move out of the ledger.                        |
| Codify output         | Vitest skeleton from feature; Gherkin echo from feature; legacy emitters from markdown | Default codify should derive stubs from `.feature` when present. `--format gherkin` should not regenerate a duplicate source. |
| Documentation surface | BDD scenarios; review-spec; planning guide; test-definition template                   | Every authoring surface must name `.feature` as source and test-definitions as ledger to avoid mixed instructions.            |

## Decisions Baked In

- Keep `test-definitions.md` for R/G/R because hard hooks already parse it and no equivalent hard gate exists for tags.
- Use official `@cucumber/gherkin` parsing for `.feature` input instead of markdown-style regexes.
- Preserve legacy markdown behavior for older tickets and during migration.
