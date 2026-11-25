# Automatic debug routing pilot

The eval-only variant adds one instruction to the packaged handbook at the start of the build workflow.

> For a reported bug whose cause is unclear or whose behavior depends on interactions between components, load the debug skill before editing. For an obvious, localized fix, use the normal patch or task workflow.

The debug skill and hooks are identical in both arms. The archive changes the handbook, inventory, and identity. The variant archive SHA-256 is `1a435557937dd6e2ca78161ff52587487941385744f7f94d04a2a40911aa4393`.

Three fresh synthetic tasks cover a stale aggregate after a record change, a deduplication key collision, and an obvious one-line label typo. The first two prompts report symptoms and the third names the replacement. None requests any particular workflow. Each hidden verifier independently scores the fix and preserved behavior. Calibration showed the original code failed the fix check and passed the preservation check on every fixture, and the reference fix passed both.

Both arms use checkout `72165cde6`, Claude Code `2.1.326`, Haiku `claude-haiku-4-5-20251001`, and fresh Docker workspaces with dependencies preinstalled. Each arm has three attempts per task, with a 50-turn, $1, 180-second cap per attempt. No replies are injected.

The pilot target is a clear increase in pre-edit debug activation on both diagnosis tasks, no debug activation on the typo, no drop in hidden behavior scores, and no material increase in typo effort. The main outcome is automatic activation. This sample can indicate whether to run a larger test.

## Results

| Measure                                      | Checkout | Routing variant |
| -------------------------------------------- | -------: | --------------: |
| Handbook instruction observed in raw trace   |      0/9 |             9/9 |
| Debug loaded before editing, diagnosis tasks |      0/6 |             0/6 |
| Debug loaded, obvious typo                   |      0/3 |             0/3 |
| Bug fix and preservation both passed         |      9/9 |             9/9 |
| Clean completion                             |      9/9 |             9/9 |
| Median turns, stale dashboard                |        5 |               5 |
| Median turns, lost import rows               |        9 |              11 |
| Median turns, obvious typo                   |        5 |               6 |
| Median estimated model cost, obvious typo    |  $0.0430 |         $0.0404 |

The handbook change reached all nine variant runs and triggered zero debug loads. Both diagnosis fixtures were small and all attempts solved them. The evidence supports holding this wording change. It leaves open whether a more ambiguous, multi-file failure would trigger the skill.

## Raw jobs

| Fixture          | Checkout                                                                                             | Variant                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Stale dashboard  | [Harbor result](../jobs/stale-dashboard-checkout-ready-deps-72165cde6-20261122T003806Z/result.json)  | [Harbor result](../jobs/stale-dashboard-checkout-ready-deps-routing-72165cde6-20261122T003947Z/result.json)  |
| Lost import rows | [Harbor result](../jobs/lost-import-rows-checkout-ready-deps-72165cde6-20261122T003806Z/result.json) | [Harbor result](../jobs/lost-import-rows-checkout-ready-deps-routing-72165cde6-20261122T003938Z/result.json) |
| Obvious label    | [Harbor result](../jobs/obvious-label-checkout-ready-deps-72165cde6-20261122T003806Z/result.json)    | [Harbor result](../jobs/obvious-label-checkout-ready-deps-routing-72165cde6-20261122T003915Z/result.json)    |
