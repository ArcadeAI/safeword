# Dimensions: Whole-ticket quality review + refactor before verify

The gate's behavior varies along four dimensions. Scenarios cover each
partition plus the load-bearing boundary (1 → 2 loops).

| Dimension                | Partitions                                                    | Notes                                                                 |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Loop count               | 0 (none) · **1** · **2+**                                     | Boundary 1→2 is the trigger; `scenarios.length` in the parsed ledger  |
| Annotation state         | annotated · unannotated (pure legacy)                         | Legacy multi-scenario tickets must stay exempt (regression guard)     |
| Ticket type              | feature · task                                                | Must share one path; `isFeature` fence removed                        |
| Cross-scenario row state | missing · unchecked · empty-skip · valid-skip · reachable-SHA | Required only when loop count ≥2 and annotated, or row already exists |
| Quality-review proof     | logged this session · not logged                              | Done-gate skill-invocation check, extended to ≥2-loop tasks           |

Partition cross-product is pruned to the behaviorally distinct cases: the
trigger boundary (1 vs 2), the legacy exemption, the task-path (fence removal),
each row-state outcome (block vs pass), and the review-log block vs pass.
