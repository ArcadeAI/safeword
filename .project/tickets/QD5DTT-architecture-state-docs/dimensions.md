# Dimensions: Architecture state docs — Slice 1

Derived from intake (scope / done-when / resolved questions) + domain knowledge. Each dimension partitioned into equivalence classes and boundary values; scenarios in `features/architecture-state-docs.feature` cover one per partition.

| Dimension                                | Partitions (classes + boundaries)                                                                                                                                                                                        | Proves   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Skeleton accuracy                        | node present with code ref; one-line `purpose` present; non-structural file excluded (boundary)                                                                                                                          | NTB1.AC1 |
| Degenerate inputs                        | no `src/` directory; unparseable source file                                                                                                                                                                             | NTB1.AC1 |
| Prose staleness marking                  | `reconciled` stamp matches → no marker; stamp drifted → `⚠ stale`; node removed → orphan flag; new node, no prose → `purpose` required but not "stale" (boundary)                                                        | NTB1.AC2 |
| Self-heal trigger                        | fingerprint moved → re-extract; fingerprint unchanged → no-op/no churn (boundary); no doc yet → create                                                                                                                   | TB1.AC1  |
| Fingerprint composition (shape vs noise) | structural change (+module, +dep, +boundary rule, +schema) → moves; semantics-preserving change (version-only bump, comment-only edit) → does not move (boundary) — metamorphic relation, captured as a Scenario Outline | TB1.AC2  |
| Drift provenance                         | change made by agent in-session; change made out-of-band (human commit, no agent)                                                                                                                                        | TB1.AC2  |

## Notes

- **`no model call` is a property, not a scenario** (quality-review, 2026-06-21): the LLM-free guarantee (done-when) is verified at the unit layer (self-heal/extractor takes no model client) and recorded as an `impl-plan.md` invariant — not a Gherkin behavior, per testing guidance that absence-of-side-effect belongs in unit checks, not standalone scenarios.
- The fingerprint composition + drift provenance both prove TB1.AC2 — kept as one capability (detection correctness, both directions) since the Scenario Outline collapses the input partitions.
