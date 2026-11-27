# What the early Harbor controls measured

These historical trials explain why the benchmark grades the delivered patch, the order of work, and independent approval separately. The original two-host runs used Safeword checkout `b4d635f57`, Claude Code 2.1.330 with Opus 5.5 and Codex CLI 0.172.0 with GPT-6.2 Sol. Each used a fresh Docker workspace. The table of [individual trial IDs and verifier results](historical-intake-trials.csv) includes the successful scored runs. The CSV lists one scored attempt per host for each of its six cases.

## Correct code and correct intake

Both authors passed the library feature, the overlap bug and the banner patch. On the library feature, Claude wrote the implementation before checking behavior. Codex opened BDD, observed a failing check, edited, and reran it. Neither produced a durable intake plan on that run. On the overlap bug, Codex opened the debug skill and reproduced the negative overlap before fixing it.

On the two-hold queue, both hosts used the supplied overflow rule without asking. When the rule was withheld, each asked once and both implemented the operator’s decision to evict the oldest hold. Claude first wrote a provisional rejection rule, then replaced it. Codex’s first production edit followed the reply. A final score of 1 in all four trials conceals that difference.

On the temperature CSV CLI, both passed all three hidden checks: conversion, skipping invalid rows, and stopping on invalid input. The [first-scenario records and control receipts](historical-control-receipts.json) show how they got there.

| Author | Observed ticket phase | Seconds to first scenario | Reviewer starts by then | Estimated author + reviewer spend by then |
| ------ | --------------------- | ------------------------: | ----------------------: | ----------------------------------------: |
| Claude | define-behavior       |                       368 |                       7 |                                    $1.504 |
| Codex  | intake                |                       116 |                       0 |                                    $0.144 |

Codex wrote its scenario inside a compound command, so 116 seconds is an upper bound. Claude had an independent approval before scenarios. Codex wrote scenarios while its ticket was still in intake.

## Reviewer and routing controls

Each provider independently reviewed the other host’s copy of three frozen CSV plans. Both approved the complete draft, requested changes to the draft missing agreed invalid-row handling, and requested changes to the draft that silently dropped a row. When the harness changed an already approved delimiter rule, both receipts returned `REVIEW_STALE`. These six draft verdicts and two stale-receipt checks calibrate the reviewer separately from the author.

A GEPA candidate that changed only the BDD description cleared its training CSV after 12 review calls. On two unseen feature prompts it earned **0/4 independent handoffs**. Both banner patch controls passed. The table gives the Harbor trial identifiers and their recorded rewards.

| Held-out fixture        | Claude trial / reward           | Codex trial / reward            |
| ----------------------- | ------------------------------- | ------------------------------- |
| intake-workshop-checkin | `workshop-checkin__4ZWFX53` / 0 | `workshop-checkin__9E2HWLF` / 0 |
| intake-library-hold-cli | `library-hold-cli__gBgbLxg` / 0 | `library-hold-cli__GPWVqLu` / 0 |
| patch-negative          | `default-banner__WY6zfze` / 1   | `default-banner__uuPpRTx` / 1   |

## What a perfect intake score left open

On a later frozen handbook candidate, both hosts ran three attempts on each of four held-out tasks. Overnight shifts and packing-slip footers used hidden behavior and preservation checks. The `parcel-shelf` and `reading-bookmarks` features stopped at independently approved intake. All 24 trials passed their respective gate. The [candidate trial records](historical-candidate-trials.csv) include the grade type, reviewer calls, spend and parking-test replay outcomes. Empty CSV cells indicate measures outside that experiment.

| Author | Trials passed | Feature trials asking for clarification | Independent reviewer calls | Recorded API-equivalent spend |
| ------ | ------------: | --------------------------------------: | -------------------------: | ----------------------------: |
| Claude |         12/12 |                                     6/6 |                         37 |                        $11.21 |
| Codex  |         12/12 |                                     1/6 |                         10 |                         $3.49 |

Seven of the twelve feature trials asked for clarification. The overnight-shift bug also prompted a question in Claude attempt 2. It is outside the feature denominator. Reviewer usage was incomplete in Claude `reading-bookmarks` attempt 3, so its cost subtotal is an estimate. This candidate-only comparison gives no improvement estimate against main.

## Did a regression test survive delivery?

The parking-charge trial checked the delivered test against the finished code and then against the original implementation. A retained test had to pass the first run and fail on a parking assertion in the second. Each cell below represents three scored runs on the same task. The CSV labels the frozen parking candidate `control` and the revised one `repaired`. The revised handbook explicitly asked for a regression test in the project suite.

| Handbook          | Author | Correct patch | Red before edit, green after | Retained regression test |
| ----------------- | ------ | ------------: | ---------------------------: | -----------------------: |
| Then-current main | Claude |           3/3 |                          3/3 |                      3/3 |
| Then-current main | Codex  |           3/3 |                          1/3 |                      0/3 |
| Frozen candidate  | Claude |           3/3 |                          3/3 |                      3/3 |
| Frozen candidate  | Codex  |           3/3 |                          3/3 |                      0/3 |
| Revised candidate | Claude |           3/3 |                          3/3 |                      3/3 |
| Revised candidate | Codex  |           3/3 |                          3/3 |                      3/3 |

Four preliminary runs used stale plugin integrity metadata and were excluded from the scored results. Estimated spend was $4.16 for the 18 scored trials and $0.66 for the excluded runs. This measures one behavior change. It does not establish a general model ranking.

Later promotion evidence is recorded in [the intake delivery PR](https://github.com/ArcadeAI/safeword/pull/8398) and the [lean-intake scorecard](../../../.project/tickets/3TJD0A-reliable-lean-intake/scorecard.md).
