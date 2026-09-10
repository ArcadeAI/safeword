# Dimensions: Resolve disputed plan findings without review loops

| Dimension | Partitions and boundaries |
| --- | --- |
| Dispute class | scope; optional strengthening; review currency; correctness; relevance |
| Resolver | user; provenance check; fresh independent adjudicator; originating reviewer alone |
| Finding state | blocking defect; nonblocking advice; accepted scope change; unresolved external decision |
| Terminal result | upheld; reclassified; rejected; pending user decision; unresolved after available routes |
| Runtime | interactive local; headless local; ephemeral cloud; advisory-only host |
| Loop behavior | one routed adjudication; silent redispatch; arbitrary pass cap; later author-correct-re-review cycle |

## Boundaries carried into scenarios

- The same reviewer never both raises and solely adjudicates a contested finding.
- Optional advice stays nonblocking unless the user accepts it into scope.
- Headless work terminates honestly instead of inventing human authority or
  waiting forever.
- The feature terminates each dispute; it does not promise to bound every later
  author-correct-re-review cycle.
