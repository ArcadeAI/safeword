# Reservation feature and extractor bug on merged Safeword

On November 27, 2026, Claude Haiku 5.5 ran the same two plain requests with and without Safeword at `649a98b80`. Each task had three independent Docker trials per arm and the same hidden grader. Claude Code was 2.1.330. Codex CLI 0.172.0 with GPT-6.2 Sol was available as the independent reviewer in the Safeword arm. The estimated budget per trial was $3 for reservation and $2 for extractor.

## Results

Both arms delivered three passing reservations. For the extractor bug, **all six authors produced a patch that met the requested CLI behavior**. One Safeword author switched back to the starter branch after committing the fix. Consequently only two of the three final Safeword checkouts worked. The built-in verifier recorded one Safeword pass.

| Task        | Arm      | Hidden passes / scored | Estimated total | Replies sent | New operator decisions |
| ----------- | -------- | ---------------------: | --------------: | -----------: | ---------------------: |
| Reservation | Baseline |                    3/3 |          $0.012 |            0 |                      0 |
| Reservation | Safeword |                    3/3 |          $0.075 |            5 |                      1 |
| Extractor   | Baseline |                    3/3 |          $0.142 |            0 |                      0 |
| Extractor   | Safeword |                    1/3 |          $0.867 |            4 |                      0 |

Costs are API-equivalent estimates for the scored trials. Replies include approved scope answers and routine approvals. Only one question required a new human decision. The operator chose to return the inventory supplied on retry, unchanged. The [reservation decision log](reservation-decisions.md) records it for reuse.

## Evidence by trial

| Task        | Arm      | Harbor trial                     | Hidden reward | Public CLI cases, final checkout | Estimated USD | Replies |
| ----------- | -------- | -------------------------------- | ------------: | -------------------------------: | ------------: | ------: |
| Reservation | Baseline | `reservation__2JKDBHv`           |             1 |                                — |        0.0048 |       0 |
| Reservation | Baseline | `reservation__G9CEXSD`           |             1 |                                — |        0.0042 |       0 |
| Reservation | Baseline | `reservation__j2c66WZ`           |             1 |                                — |        0.0031 |       0 |
| Reservation | Safeword | `reservation__FPsbeTC`           |             1 |                                — |        0.0209 |       1 |
| Reservation | Safeword | `reservation__aUPzxvb`           |             1 |                                — |        0.0338 |       3 |
| Reservation | Safeword | `reservation__qkRkNKK`           |             1 |                                — |        0.0202 |       1 |
| Extractor   | Baseline | `extractor-trace-empty__R7vooTP` |             1 |                              4/4 |        0.0396 |       0 |
| Extractor   | Baseline | `extractor-trace-empty__RGzSPho` |             1 |                              4/4 |        0.0553 |       0 |
| Extractor   | Baseline | `extractor-trace-empty__zQv9sKk` |             1 |                              4/4 |        0.0468 |       0 |
| Extractor   | Safeword | `extractor-trace-empty__Mq9y9S7` |             0 |                              2/4 |        0.3053 |       1 |
| Extractor   | Safeword | `extractor-trace-empty__Nj7dj9n` |             0 |                              4/4 |        0.1813 |       2 |
| Extractor   | Safeword | `extractor-trace-empty__bzayuYD` |             1 |                              4/4 |        0.3802 |       1 |

## Why the extractor grades differ

The original verifier calls the shared `runTrace` function directly. The user requested behavior at the `trace` command. To check that boundary, replay each patch in a clean container with networking disabled. Launch the actual CLI with a deterministic matcher client. Check exit status, diagnostic and the written report for two empty cases (compared but unmatched, and no overlapping areas). Check successful exit and a nonempty report both for a normal match and for a match alongside an area error. The untouched starter failed both empty cases and passed both positive controls.

- `Nj7dj9n` implemented the error at the CLI boundary. Its checkout passed all four CLI checks, despite its hidden reward of zero.
- `Mq9y9S7` committed a working fix, then restored the starting branch. The final checkout failed both empty cases. Replaying the successful edits reproduced Git commit `0d1088ba3e12b7a14ceded11ea38043f2ef38a54`, matching the author’s reported commit prefix. That commit passed all four checks.
- `bzayuYD` passed both the original verifier and all four CLI checks. All three baseline patches also passed both.

## Setup and interpretation

Twelve reservation attempts ended during setup or before author execution and were excluded. Five hit the Claude download timeout, one hit a network error, three stopped on empty Git-ref output and three hit an npm directory-replacement error. The scored fixtures preloaded the same verified Claude executable (SHA-256 prefix `6016f90cac78`). In a run-local copy of the adapter, empty Git stdout became an empty ref set, and the npm helper removed its old package directory after packaging it and before installing the archived replacement. The merged Safeword plugin, task prompts and frozen hidden verifiers were unchanged.

These two tasks give no evidence of a correctness advantage for Safeword. The baseline was cheaper on both. Future extractor comparisons should grade the public command and identify whether the patch under test came from the final worktree or a named delivery commit.
