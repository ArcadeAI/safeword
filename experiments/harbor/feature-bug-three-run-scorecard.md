# Three-run feature and bug comparison

Run on November 21, 2026 Pacific time. Three attempts per arm and task.
The arms were no Safeword, stable release 1.1.0, and unreleased checkout
`72165cde6`. All used Claude Code 2.1.326 and Haiku 4.5 in isolated Docker
workspaces. The prompt and frozen verifier were the same across arms for
each task. Each Claude invocation had a 50-turn cap and $1 model budget.
The trace bug ran without replies and had a 300-second agent timeout. The
reservation feature used the human relay with a longer timeout to permit
replies and resumed invocations. Concurrent bug attempts competed for the
same Docker host, so their timeouts are evidence under this run's conditions.

The reservation reply policy applied equally to all arms. An answer was
delivered only after a real request. The recorded scope and return-shape
answers were replayed where applicable. I answered follow-up requests to
continue scenario review only within that scope. I treated statements of
completion as terminal handoffs. Scripted replies are counted as replies,
and a message containing several questions is one input checkpoint.
[Exact checkpoints and replies](jobs/feature-bug-relay-20261122T012110Z)

## Reservation feature

| Measure                                    | No Safeword | Stable release |  Checkout |
| ------------------------------------------ | ----------: | -------------: | --------: |
| Hidden verifier passed                     |         3/3 |            1/3 |       2/3 |
| Human-input checkpoints / replies          |       0 / 0 |          5 / 5 |     3 / 3 |
| Median Claude turns across invocations     |          10 |             68 |        33 |
| Median reported model cost                 |      $0.049 |         $0.448 |    $0.236 |
| Total input tokens including cache         |     876,146 |      9,209,946 | 4,252,492 |
| Total output tokens                        |      16,713 |         61,635 |    41,874 |
| Captured authored BDD scenarios            |           0 |             16 |         0 |
| Attempts delivering a standalone test file |         2/3 |            0/3 |       3/3 |

All three baseline attempts passed without help. One release attempt passed.
Another hit the turn limit after creating scenarios and a separate module,
while leaving the required entry point as a stub. The remaining release
attempt stopped after scenario review with no open human question and no
implementation. I supplied no continuation on a self-directed next step.

The checkout's two passing attempts used the expected return shape. Its
failed attempt wired the correct export name to a module that returned
`{ success, message }` instead of `{ status, inventory }`. Its own tests
passed against that changed contract. A supplemental replay confirmed every
passing implementation returns `reserved` again after retrying the request
that consumed the last unit. The frozen grader was unchanged.

The scenario counts measure authored artifacts. They give no credit for
execution or passing coverage. Two checkout runs had a failed test run
followed by a passing run after edits to the tests. Those sequences do
not establish failing-then-passing implementation evidence.

## Historical trace bug

| Measure                                   | No Safeword | Stable release |  Checkout |
| ----------------------------------------- | ----------: | -------------: | --------: |
| Hidden verifier passed                    |         2/3 |            2/3 |       1/3 |
| Passing code and clean agent completion   |         1/3 |            0/3 |       0/3 |
| Agent timeouts                            |         1/3 |            3/3 |       3/3 |
| Reported model cost                       |      $1.524 |         $1.062 |    $1.406 |
| Reported input tokens including cache     |   9,591,468 |      6,426,829 | 8,702,705 |
| Reported output tokens                    |      66,695 |         45,864 |    58,100 |
| Attempts that changed the trace test file |         3/3 |            2/3 |       2/3 |

Harbor graded the code saved at timeout. Two failed patches still returned
success in both empty modes. The other two failures were a release patch
that still returned success when there was nothing to compare, and a
checkout patch that described an all-areas failure as a no-match result.
The reported bug cost and tokens use Harbor's agent metrics, including
partial metrics on timeouts. Reliable final turn counts were unavailable
for the timed-out attempts.

## Harbor jobs

| Task        | No Safeword                                                                                  | Stable release                                                                              | Checkout                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Reservation | [Result](jobs/reservation-baseline-ready-deps-human-72165cde6-20261122T012113Z/result.json)  | [Result](jobs/reservation-release-ready-deps-human-72165cde6-20261122T012113Z/result.json)  | [Result](jobs/reservation-checkout-ready-deps-human-72165cde6-20261122T012113Z/result.json)  |
| Trace bug   | [Result](jobs/extractor-trace-empty-baseline-default-72165cde6-20261122T012113Z/result.json) | [Result](jobs/extractor-trace-empty-release-default-72165cde6-20261122T012113Z/result.json) | [Result](jobs/extractor-trace-empty-checkout-default-72165cde6-20261122T012113Z/result.json) |
