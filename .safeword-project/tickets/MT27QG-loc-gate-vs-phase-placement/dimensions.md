# Dimensions — git-operation-aware LOC gate

Two surfaces: the pure detector, and the gate's use of it.

| Dimension              | Partitions                                                                                                             | Proves   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| Git operation state    | none · merge (MERGE_HEAD) · rebase (rebase-merge/rebase-apply) · cherry-pick (CHERRY_PICK_HEAD) · revert (REVERT_HEAD) | AC1, AC2 |
| Repo presence          | inside a git repo · not a git repo (detector must not crash → false)                                                   | AC2      |
| LOC × operation (gate) | ≥400 LOC + operation in progress (do NOT arm) · ≥400 LOC + no operation (arm as before)                                | AC1, AC2 |

The detector is unit-tested against a temp repo with markers touched directly.
Two integration tests prove the gate consults it: ≥400 LOC mid-merge does not
arm; ≥400 LOC with no operation still arms (no regression).
