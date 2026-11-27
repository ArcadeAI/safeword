# BDD Extractor thin text smoke

One baseline attempt and two setup failures. This is a fixture smoke,
not a ranking. See `jobs/extractor-thin-text-*-20261120T021235Z/` for evidence.

| Measure                  | No Safeword                    | Release 1.1.0        | Checkout 72165cde6   |
| ------------------------ | ------------------------------ | -------------------- | -------------------- |
| Trial setup              | Valid                          | Failed before launch | Failed before launch |
| Hidden functional checks | 3/3                            | Not evaluated        | Not evaluated        |
| Human requests / replies | 0 / 0                          | Not evaluated        | Not evaluated        |
| Delivery                 | Finished; full suite timed out | Not evaluated        | Not evaluated        |

Docker calibration used frozen copies of the historical tests, with
network disabled. The pre-fix snapshot at `9e0aafee` failed only the
trailing-padding case. Applying `2581909` in a separate container passed
all checks. The fixture has synthetic local Git history with one commit
and no remote. The original project checkout was untouched.

The baseline candidate changed extraction and updated nine page snapshots.
Its hidden checks independently verified padded short text, exact-threshold
behavior, and code block whitespace. The full-suite timeout and the snapshot
changes need to be considered in code review.

Both initial treatment setups lacked a Safeword CLI dependency. The
wrapper now requests a pinned 1.1.0 CLI dependency before activating the
arm's tagged or checkout plugin. This retry stopped before provisioning
because 1Password authorization timed out. Treatment activation remains
unverified. No comparative judgment is warranted.

## Setup fix and verification

Reproduced the failing installer command in the baseline Docker image.
Bun was resolving dependencies when the 120-second timeout killed it.
The treatment image now uses a frozen lockfile and includes the pinned
CLI before trial setup. The baseline build target remains separate.
The cold treatment build installed the locked packages in about 332
seconds. In two fresh containers with networking disabled, the exact
offline provisioning and local marketplace installation succeeded, and
Claude listed the intended enabled project plugin (1.1.0 and 1.2.0,
respectively). This verifies setup. It does not change the trial scores
above. No model calls were needed for this check.

## Treatment rerun

The treatment retries completed with no trial exceptions. Claude 2.1.326
reported the intended local plugin path on both session starts.

| Measure                            | No Safeword    | Release 1.1.0 | Checkout 72165cde6 |
| ---------------------------------- | -------------- | ------------- | ------------------ |
| Frozen functional checks           | 3/3            | 3/3           | 3/3                |
| Delivery                           | Finished       | Finished      | Finished           |
| Human requests / replies           | 0 / 0          | 0 / 0         | 0 / 0              |
| Standalone regression checks added | 0 observed     | 1             | 1                  |
| Claude turns                       | Not re-audited | 36            | 49                 |
| Estimated model cost               | Not re-audited | $0.347        | $0.464             |

Treatment evidence is under `jobs/extractor-thin-text-*-20261121T233909Z/`.
Both verifier scores were reported to LangSmith. The checkout's captured diff
also contains macOS metadata files. Exclude infrastructure changes and
archive metadata from authored line counts. These are smoke results from
one attempt per arm. Code review, authored test discrimination, and baseline
usage accounting remain separate from the functional verdict.

## Audited delivery and proof

The independent reviewer saw anonymized patches A (checkout), B (baseline),
and C (release). I replayed the findings against each saved patch and the
starting snapshot in network-disabled containers. These diagnostics do not
retroactively change the original Harbor scores.

| Measure                                                         | No Safeword | Release 1.1.0 |   Checkout |
| --------------------------------------------------------------- | ----------: | ------------: | ---------: |
| Hidden functional checks                                        |         3/3 |           3/3 |        3/3 |
| Follow-up compatibility checks                                  |         2/3 |           1/3 |        2/3 |
| New BDD scenarios / product evals                               |       0 / 0 |         0 / 0 |      0 / 0 |
| New focused regression tests                                    |           0 |             1 |          1 |
| In-run TDD cycles verified                                      |           0 |             0 |          0 |
| Authored focused test fails with original bug and exits nonzero | No new test |           Yes |        Yes |
| Human requests / replies                                        |       0 / 0 |         0 / 0 |      0 / 0 |
| Turns                                                           |          48 |            36 |         49 |
| Tokens including cached input                                   |   3,547,993 |     2,110,933 |  3,103,295 |
| Estimated session cost                                          |      $0.568 |        $0.347 |     $0.464 |
| Final extraction file lines / lines added in test harness       |   1,031 / 0 |    1,031 / 34 | 1,052 / 21 |

Baseline turns and tokens sum the three result records; cost uses the last
cumulative session total. Line counts exclude generated setup and archive
metadata. The baseline also added 2,070 snapshot lines across four unused
fixtures and removed a leading blank line from five existing snapshots.

- **Baseline:** The new body trim removes leading whitespace that previously
  counted toward usable text. At the threshold, that triggers fallback.
- **Release:** The same threshold regression occurs. The patch also adds
  a blank separator to title-only output that previously had none.
- **Checkout:** It preserves both of those behaviors, but can report
  `keptShare=0.1` for a fallback that delivered its entire body. The helper
  adds a second threshold decision and broadens the fix to reporting.

Both new regression tests passed on the delivered patch and failed with exit
1 after restoring the original extraction code. This is replayed proof
quality, separate from a fail-before/pass-after sequence in the agent run.
None of the three patches should be accepted as-is.
