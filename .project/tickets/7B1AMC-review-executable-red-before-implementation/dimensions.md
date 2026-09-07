# Dimensions: Stop hollow acceptance proofs before implementation

| Dimension           | Partitions and boundaries                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| Proof lifecycle     | new, materially changed, unchanged reuse, implementation-only change                                 |
| Execution identity  | exact selected test, unrelated selected test, no selected test                                       |
| RED outcome         | intended assertion failure, unexpected pass, collection/setup failure, interrupted process           |
| Contract boundary   | claimed actor entrypoint and observable, narrower internal substitute                                |
| Evidence provenance | trusted execution, author-supplied output, missing execution                                         |
| Receipt freshness   | unchanged proof inputs, changed scenario, proof plan, test, glue, helper, command, or evidence class |
| Review provenance   | independent approval, self-review, cached suite status, unavailable reviewer route                   |
| Proof reuse         | one implementation shared by outline rows, one umbrella verdict shared by distinct implementations   |
| Host surface        | Claude Code local/cloud, Codex local/cloud, OpenCode, Cursor local/cloud, direct Safeword CLI        |
| Recovery experience | missing, stale, wrong-reason, or unavailable evidence with one concrete next action                  |

Every partition above is now bound to a feature scenario or Scenario Outline row. Exhaustive malformed receipt fields and runner-specific failure encodings belong in table-driven lower-level tests; the feature scenarios retain representative user-visible boundaries.
