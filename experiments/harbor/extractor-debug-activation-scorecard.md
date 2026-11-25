# BDD Extractor debug-skill activation

The fixture freezes BDD Extractor at pre-fix revision `9e0aafee`. The task is to measure actual extracted text without letting trailing whitespace bypass the existing thin-page fallback. The hidden verifier separately checks the bug, behavior exactly at the threshold, and preservation of fallback whitespace.

The natural activation smoke used the existing feature-only prompt. Claude Code reported `safeword:debug` and the Skill tool as available. Claude read the Safeword handbook and began writing a regression test without invoking the skill. The handbook routes small bug fixes through its general task and TDD workflow without directing the agent to load debug. The skill description makes it discoverable, leaving invocation to the model. This trace shows the available skill was bypassed on this run.

The follow-up used the same extractor snapshot and hidden verifier. Both arms were told to load `safeword:debug` before editing and given the implementation filename. Both used Safeword checkout `72165cde6`, Claude Code `2.1.326`, Haiku `claude-haiku-4-5-20251001`, isolated Docker workspaces, a 50-turn cap, a $1 spend cap, and a 300-second run limit. The variant changed only the debug paragraph and archive integrity metadata. The variant archive SHA-256 is `e7ccad8114afc0dc062ce2bbb939a51cb93cb2e7d18e6047eab29444ffa2cff7`.

The explicit request measures the effect of the guidance after activation. The natural smoke measures one opportunity for automatic activation. The extractor fixture is a reused diagnostic and the three repetitions are on a single bug.

## Raw jobs

- [Natural checkout smoke](jobs/extractor-thin-text-checkout-default-72165cde6-20261122T002923Z/result.json)
- [Explicit debug, checkout](jobs/extractor-thin-text-checkout-debug-loaded-72165cde6-20261122T003047Z/result.json)
- [Explicit debug, variant](jobs/extractor-thin-text-checkout-debug-loaded-preservation-72165cde6-20261122T003047Z/result.json)

## Results

| Measure                                                    | Natural checkout | Explicit debug, checkout | Explicit debug, variant |
| ---------------------------------------------------------- | ---------------: | -----------------------: | ----------------------: |
| Confirmed debug skill launches                             |              0/1 |                      3/3 |                     3/3 |
| All three hidden checks passed                             |              1/1 |                      3/3 |                     3/3 |
| Clean agent completion                                     |              0/1 |                      2/3 |                     3/3 |
| Median reported turns                                      |               51 |                       21 |                      24 |
| Median reported model cost                                 |           $0.582 |                   $0.221 |                  $0.233 |
| Focused preservation check verified before and after edits |              0/1 |                      0/3 |                     0/3 |

The natural run hit the turn cap after producing passing code. One explicitly prompted checkout attempt timed out after producing passing code. Turn and cost figures use the last available Claude result event, including for that timeout. The raw traces contain the added paragraph in all three variant attempts and in none of the three explicit checkout attempts.

All six prompted attempts changed `extract.ts`. None delivered a tracked regression-test change. Shared package and Safeword setup diffs were present in the verifier patches. One timed-out checkout attempt also deleted hundreds of macOS metadata sidecars from the frozen snapshot, and one variant attempt changed additional Safeword configuration files. Treat those as scope and fixture observations, separate from the hidden behavior checks.

The wrapper was edited while the natural job was in progress. The natural job wrote its Harbor trial and verifier results, then the wrapper printed a shell parse error as it resumed. The wrapper passes `sh -n` and completed both comparison jobs.

Keep the variant out of the release. The wording produced no observed improvement in behavior preservation or in running a focused before-and-after check. The next test should isolate automatic activation on fresh bug reports that require diagnosis, while measuring whether a narrow routing change leaves obvious one-line fixes lightweight.
