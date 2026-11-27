# Debug routing on a historical BDD Extractor bug

The trace command could successfully exit after producing an empty match report. The CLI dispatches the command from `cli.ts`; the match and report handling that allowed the false success lives in `trace.ts`. Agents received the same symptom and expected behavior, without the source paths or debugging instructions.

The task freezes the parent of the historical fix `feb9475ffd837891897901e7c3f3867d38b0348a` at `893a2376ece7114d86a994665157bc8096acf92a`, with project task history and agent setup stripped from the snapshot. The historical trace tests live on the verifier side. Calibration with the frozen source failed exactly the two empty-result cases. Swapping in the historical `trace.ts` fix passed the full trace suite, including matched and partially failed runs. The verifier also checks that the empty-result report is written.

The checkout and the one-line handbook variant both use Safeword `72165cde6`, Claude Code `2.1.326`, Haiku `claude-haiku-4-5-20251001`, and fresh Docker workspaces. Each ran three attempts on the historical bug and three on the one-line typo from the prior pilot. Both arms had a 50-turn and $1 cap. The trace attempts had a 300-second limit, and the typo attempts had 180 seconds. No human replies were injected.

The primary measurement is whether the debug skill loads before editing the bug. Hidden correctness checks and the typo control show whether behavior and effort also change. The eval-only variant is the same archive as the [synthetic pilot](../debug-routing/scorecard.md).

## Results

| Measure                                                          | Checkout | Routing variant |
| ---------------------------------------------------------------- | -------: | --------------: |
| Trace runs that received the routing sentence                    |      0/3 |             3/3 |
| Debug loaded before editing, trace bug                           |      0/3 |             0/3 |
| Trace bug fixed and prior behavior preserved, corrected verifier |      1/3 |             2/3 |
| Trace behavior preserved, corrected verifier                     |      3/3 |             3/3 |
| Trace attempt completed without hitting a limit                  |      0/3 |             1/3 |
| Debug loaded, typo                                               |      0/3 |             0/3 |
| Typo fix and preservation passed                                 |      3/3 |             3/3 |
| Median turns, typo                                               |        5 |               4 |
| Median reported model cost, typo                                 |  $0.0372 |         $0.0378 |

The historical suite originally accepted only the reference diagnostic phrasing. It stopped early on equivalent messages and gave both arms 0/3 in Harbor. I broadened the verifier to accept equivalent wording, checked it against the original and reference source again, and regraded the six saved patches in isolated local directories. The replay applied changes under the extractor source directory and used the same independent hidden tests. Harbor's original records are kept below. The corrected scores describe candidate behavior. They are separate from clean agent completion.

All six candidates made the compared-but-no-matches case fail and kept the regression checks passing. The three failed candidates, two checkout and one variant, still returned success when there was nothing to compare. Debug activation stayed at zero, so the extra variant pass on this small sample does not show that the routing instruction did its job. Drop this handbook sentence.

## Evidence

- [Trace checkout, original Harbor result](../jobs/extractor-trace-empty-checkout-default-72165cde6-20261122T004722Z/result.json)
- [Trace variant, original Harbor result](../jobs/extractor-trace-empty-checkout-default-routing-72165cde6-20261122T004722Z/result.json)
- [Corrected verifier replay logs](../jobs/extractor-trace-regrade-20261122)
- [Typo checkout](../jobs/obvious-label-checkout-ready-deps-72165cde6-20261122T004722Z/result.json)
- [Typo variant](../jobs/obvious-label-checkout-ready-deps-routing-72165cde6-20261122T004722Z/result.json)

## Public CLI verifier replay, November 27, 2026

We replayed the six saved extractor checkouts from the [matched feature and bug comparison](https://github.com/ArcadeAI/safeword/pull/8538) with the v3 Harbor verifier. The author model was Claude Haiku 5.5. Each checkout ran offline against the actual CLI and the remaining historical regression tests.

| Arm      | Trial     | v2 reward | v3 checkout reward | CLI cases passed |
| -------- | --------- | --------: | -----------------: | ---------------: |
| Baseline | `R7vooTP` |         1 |                  1 |              4/4 |
| Baseline | `RGzSPho` |         1 |                  1 |              4/4 |
| Baseline | `zQv9sKk` |         1 |                  1 |              4/4 |
| Safeword | `bzayuYD` |         1 |                  1 |              4/4 |
| Safeword | `Nj7dj9n` |         0 |                  1 |              4/4 |
| Safeword | `Mq9y9S7` |         0 |                  0 |              2/4 |

All six passed the remaining historical regression checks. `Nj7dj9n` handled the failure at the command boundary. `Mq9y9S7` left the starter checked out. Its reconstructed commit `0d1088ba3e12b7a14ceded11ea38043f2ef38a54` passed 4/4 in a separate worktree. Other historical commit objects were unavailable in the saved patches. No new author runs were needed.
