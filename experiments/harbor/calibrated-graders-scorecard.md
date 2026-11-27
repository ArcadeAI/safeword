# Reservation and trace grader calibration

The reservation grader requires a successful retry to return `reserved`,
including after the first call consumed the last unit. Its LangSmith dataset
is now `safeword-reservation-v3` (`-human` for relay runs). The trace grader
requires a run with matches to finish even if some areas fail. Its new
dataset is `safeword-extractor-trace-empty-v2`.

The actual Docker verifiers scored 1 for both reference fixes and 0 for the
two original implementations and all four targeted broken fixes. Calibration
checks that each failure reaches the expected assertion or test. Reproduce
these eight controls with `./calibrate-graders.sh` from this directory.

## Replay of existing attempts

One Docker container at a time replayed the nine captured reservation
submissions from the recorded-reply batch and the nine trace patches from the
three-run batch. The revised verifiers produced the same pass counts as the
original verifiers on these saved candidates.

| Task        | No Safeword | Stable release | Checkout |
| ----------- | ----------: | -------------: | -------: |
| Reservation |         3/3 |            1/3 |      1/3 |
| Trace bug   |         2/3 |            2/3 |      1/3 |

This replay measures grader behavior on existing candidates. It carries
forward no claims about agent completion or runtime. The old Harbor scores
remain in their original experiments. [Local replay results](jobs/calibrated-replay-20261122/results.txt)

The fresh low-concurrency comparison did not start. Both 1Password CLI
attempts timed out before credentials were available to Harbor.
