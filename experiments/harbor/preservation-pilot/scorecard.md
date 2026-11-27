# Bug-fix preservation pilot

Question: Does a short instruction in the debug skill help agents preserve existing behavior while fixing a bug?

Five synthetic JavaScript bugs covered cache expiry, delivery fees, stable sorting, relative URL parameters, and page-size validation. Each had separate hidden checks for the fix and for existing behavior. The original implementation failed the fix check and passed the preservation check on all five tasks. Each reference patch passed both.

Both arms used Safeword revision `72165cde6`, Claude Code `2.1.326`, Haiku `claude-haiku-4-5-20251001`, and one isolated Docker workspace per attempt. Each arm had three attempts per task, a 50-turn cap, a $1 model budget, and a 180-second agent timeout. Both arms received the source filename and had dependencies preinstalled. The variant added one paragraph to the debug skill about rerunning a focused check for existing behavior before and after the fix. No human replies were injected.

The pilot required at least three additional passes across two or more tasks, no loss of functional passes or increase in materially out-of-scope changes, and no more than 10% growth in median turns or spend. A second batch would be needed before shipping.

## Setup exclusions

The initial attempts sometimes stopped after loading the Safeword handbook and asked for a task they had already received. A later attempt with a more direct request exposed another setup problem: some agents only searched for `.js` and `.ts` files, missing the `.mjs` source. The scored comparison used the same direct request and explicit filename in both arms. The behavioral requirements and hidden checks were unchanged.

## Results

| Measure                                                                                    |  Checkout | Debug guidance variant |
| ------------------------------------------------------------------------------------------ | --------: | ---------------------: |
| Bug fix and preservation both pass                                                         |     15/15 |                  13/15 |
| Bug fix checks pass                                                                        |     15/15 |                  13/15 |
| Preservation checks pass                                                                   |     15/15 |                  13/15 |
| Observed debug skill loads                                                                 |      0/15 |                   0/15 |
| Median turns                                                                               |         8 |                      9 |
| Median model cost                                                                          |   $0.0567 |                $0.0567 |
| Total model cost                                                                           |    $0.884 |                 $1.083 |
| Total input tokens including cached reads and writes                                       | 3,837,840 |              4,670,542 |
| Total output tokens                                                                        |    41,307 |                 60,555 |
| Median final implementation lines                                                          |         6 |                      5 |
| Delivered BDD scenarios, standalone test cases, and product evals in captured source files |    0 each |                 0 each |
| Verified failing-then-passing TDD cycles                                                   |         0 |                      0 |
| Human-input tool requests / human replies                                                  |     0 / 0 |                  0 / 0 |

All four other tasks scored 3/3 in both arms. Page-size validation scored 3/3 on checkout and 1/3 on the variant. The two failures both returned `undefined` instead of the existing `null` for invalid values. The hidden checks rejected it both for the malformed-input fix and for the existing out-of-range behavior.

Hold the guidance change. The checkout passed every check, the variant failed two cases, and none of the 30 raw logs showed an invocation or read of the changed debug skill. The comparison shows what happened with the two installed bundles in this pilot. It cannot attribute the observed difference to the added paragraph. A follow-up should first confirm that the debug workflow activates on a realistic bug fix with overlapping existing behavior.

The scorer used Harbor's verifier artifacts and Claude's raw JSON logs for turns, cost, and tokens. Harbor reported trajectory conversion errors on 25 trials. The raw logs remained available for all 30. Code and delivered-test inspection was scoped to captured source files. Some agents ran inline checks after making changes.

The scored checkout jobs start at `20261122T002120Z` under [Harbor jobs](../jobs). The scored variant jobs have `ready-deps-preservation` in their names and start between `20261122T002258Z` and `20261122T002346Z`.
