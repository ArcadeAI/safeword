# Dimensions: Resolve disputed plan findings without review loops

| Dimension | Partitions and boundaries |
| --- | --- |
| Dispute class | scope; optional-strengthening scope adoption; optional-strengthening classification; review currency; correctness; relevance |
| Resolver | user for scope; provenance check for currency; fresh independent adjudicator for disputed optional classification; recorded disagreement for correctness or relevance |
| Finding state | blocking defect; nonblocking advice; accepted scope change; unresolved external decision |
| Disposition | nonblocking disagreement; pending user decision; unresolved blocking finding; fresh review after material correction |
| Runtime | interactive local; headless local; ephemeral cloud; advisory-only host; OpenCode excluded by user decision (2026-11-14, #7491) |
| Loop behavior | unchanged disagreement stops; material correction permits fresh review; arbitrary pass cap; later author-correct-re-review cycle |

## Boundaries carried into scenarios

- The same reviewer never both raises and solely adjudicates a contested finding.
- Optional advice stays nonblocking unless the user accepts it into scope.
- Headless work terminates honestly instead of inventing human authority or
  waiting forever.
- A blocking disagreement remains unresolved until correction and fresh review;
  it does not promise to bound every later author-correct-re-review cycle.
