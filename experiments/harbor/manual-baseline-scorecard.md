# Manual Harbor baseline

Run on November 21, 2026 Pacific time. Suite commit `246f75597`. The
comparison used no Safeword, the stable npm release `1.1.0` (release tag
`d5885e58771cd87f8108196ce67986f7725a1974`), and the checkout
`72165cde6`. The npm `next` tag pointed to the `2.0.0-rc.1` prerelease.
The release archive SHA-256 was
`f0c0735045e6d0e25c3e9788873d4c43a46492a57b8bafd637453d869d704fb3`.

One attempt per task and arm. Every attempt used an isolated Docker
workspace, Claude Code `2.1.326`, Haiku `claude-haiku-4-5-20251001`,
50 turns, and a $1 model budget. Task-specific timeouts and input prompts
were shared across all arms. The two extractor tasks used the historical
snapshots and the corrected trace grader. The run captured requests for
human input in the transcripts and supplied zero replies. This is a
baseline for unattended runs, with one sample per task and arm.

## Results

| Measure                                      | No Safeword | Stable release |  Checkout |
| -------------------------------------------- | ----------: | -------------: | --------: |
| Original Harbor verifier passes              |         8/9 |            5/9 |       6/9 |
| Passes after corrected trace replay          |         8/9 |            5/9 |       7/9 |
| Passing code and clean process exit          |         6/9 |            3/9 |       6/9 |
| Human-input requests / replies               |       0 / 0 |          1 / 0 |     1 / 0 |
| Median turns, attempts with final telemetry  |           8 |             15 |      11.5 |
| Reported model cost, 8 of 9 attempts per arm |      $0.818 |         $1.312 |    $1.178 |
| Reported input tokens, including cache       |   4,532,589 |      8,129,440 | 6,808,400 |
| Reported output tokens                       |      43,530 |         55,371 |    50,143 |

One timed-out attempt per arm lacked final Claude usage. Token, cost, and
turn figures describe the eight attempts per arm with that telemetry.
Both Safeword arms requested input on reservation. The stable release
asked for a plan approval and the checkout asked scope questions.

The trace grader initially missed an equivalent error message from
checkout. It now accepts “no areas had both” alongside the other
equivalent descriptions. A local replay on all three captured patches
passed baseline and checkout. Release still failed with a runtime error
when looking up the first area failure in an empty collection. The
unchanged historical source still failed both new-behavior checks, and
the reference patch passed. [Replay logs](jobs/manual-baseline-trace-regrade-20261122)

## Proof spot checks

- The behavior task produced 5, 4, and 4 written scenarios for baseline,
  release, and checkout. Cucumber output confirmed 5 passing scenarios for
  baseline and 4 for release. The checkout checked behavior separately
  with a JavaScript test.
- All three arms ran the same discount regression check before and after
  their implementation edit. It caught 17.95 before the fix and passed
  with 17.96 afterward.
- Baseline and release each produced an eval and demonstrated that their
  grader rejects a wrong expected value. Checkout produced unit tests.
  All three left the original `decide` entry point untouched and failed
  the hidden functional verifier.
- The suite has final-code artifacts for the two extractor tasks and the
  four synthetic tasks that archive proof. This baseline spot-checks
  those artifacts and traces. It does not assign full code-review grades
  or claim a suite-wide final line count.

## Task results

A linked score opens the original Harbor result. An asterisk denotes the
corrected trace score from the replay.

| Task                  | No Safeword                                                                                | Stable release                                                                               | Checkout                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| extractor-trace-empty | [Pass](jobs/extractor-trace-empty-baseline-default-72165cde6-20261122T010410Z/result.json) | [Fail](jobs/extractor-trace-empty-release-default-72165cde6-20261122T010410Z/result.json)    | [Pass*](jobs/extractor-trace-empty-checkout-default-72165cde6-20261122T010410Z/result.json)   |
| extractor-thin-text   | [Pass](jobs/extractor-thin-text-baseline-default-72165cde6-20261122T010410Z/result.json)   | [Pass](jobs/extractor-thin-text-release-default-72165cde6-20261122T010410Z/result.json)      | [Pass](jobs/extractor-thin-text-checkout-default-72165cde6-20261122T010410Z/result.json)      |
| reservation           | [Pass](jobs/reservation-baseline-ready-deps-72165cde6-20261122T010410Z/result.json)        | [Awaiting input](jobs/reservation-release-ready-deps-72165cde6-20261122T010410Z/result.json) | [Awaiting input](jobs/reservation-checkout-ready-deps-72165cde6-20261122T010523Z/result.json) |
| edit-preservation     | [Pass](jobs/edit-preservation-baseline-ready-deps-72165cde6-20261122T010525Z/result.json)  | [Fail](jobs/edit-preservation-release-ready-deps-72165cde6-20261122T010600Z/result.json)     | [Pass](jobs/edit-preservation-checkout-ready-deps-72165cde6-20261122T010609Z/result.json)     |
| false-done            | [Pass](jobs/false-done-baseline-ready-deps-72165cde6-20261122T010650Z/result.json)         | [Pass](jobs/false-done-release-ready-deps-72165cde6-20261122T010659Z/result.json)            | [Pass](jobs/false-done-checkout-ready-deps-72165cde6-20261122T010734Z/result.json)            |
| simple-fix            | [Pass](jobs/simple-fix-baseline-ready-deps-72165cde6-20261122T010753Z/result.json)         | [Pass](jobs/simple-fix-release-ready-deps-72165cde6-20261122T010825Z/result.json)            | [Pass](jobs/simple-fix-checkout-ready-deps-72165cde6-20261122T010827Z/result.json)            |
| behavior-proof        | [Pass](jobs/behavior-proof-baseline-ready-deps-72165cde6-20261122T010909Z/result.json)     | [Pass](jobs/behavior-proof-release-ready-deps-72165cde6-20261122T010924Z/result.json)        | [Pass](jobs/behavior-proof-checkout-ready-deps-72165cde6-20261122T010928Z/result.json)        |
| regression-proof      | [Pass](jobs/regression-proof-baseline-ready-deps-72165cde6-20261122T010933Z/result.json)   | [Pass](jobs/regression-proof-release-ready-deps-72165cde6-20261122T010936Z/result.json)      | [Pass](jobs/regression-proof-checkout-ready-deps-72165cde6-20261122T010938Z/result.json)      |
| eval-proof            | [Fail](jobs/eval-proof-baseline-ready-deps-72165cde6-20261122T010945Z/result.json)         | [Fail](jobs/eval-proof-release-ready-deps-72165cde6-20261122T010955Z/result.json)            | [Fail](jobs/eval-proof-checkout-ready-deps-72165cde6-20261122T010956Z/result.json)            |
