# Intake evaluation scorecard

Baseline product `904e78010`. Claude Opus 5.5 and Codex GPT-6.2 Sol, using frozen CLI versions and prices. Intake success requires a correct plan, independent approval and no premature edits. A correct guess receives no clarification credit.

## Decision

Keep the 65-line reduction. The selected version cleared independent review on all six author runs across equipment loans, shifts and bookmarks, once per host per feature. Across the eight equipment-loan variants, all 16 completed trials cleared independent review. One earlier Codex attempt failed during workspace routing and is listed separately. The broader cut allowed a premature code edit on the scheduling task.

Keep the baseline reviewer wording. The proposed stricter wording caught the missing café decision in three of three Codex reviews and zero of three Claude reviews. The experiment is complete. Reliable detection on Claude remains open.

On the equipment task, estimated author and reviewer spend for the two completed baseline trials totaled $2.15. The two completed selected-version trials totaled $2.42. An interrupted Codex setup attempt had incomplete cost evidence. These runs establish a shorter prompt and successful handoffs. They do not establish a cost saving.

## Repository verification

All five generated surfaces and all eleven parity contracts passed on the final product checkout. The full run found five assertions that still expected duplicated instructions and one OpenCode setup timeout. The assertions now verify the persona code in the plan template and the handoff from handbook to skill to intake guide. Both affected test files passed on recheck. The unchanged OpenCode fixture passed separately with cached dependencies and remote model fetching disabled. Fourteen CLI tests and one relay test were skipped in the full run.

## Frozen café plan

| Wording | Reviewer | Required a missing decision | Reopened a supplied decision | Approved supplied plan | Paired success |
|---|---|---:|---:|---:|---:|
| Original | Claude | 0/3 | 0/3 | 3/3 | 0/3 |
| Original | Codex | 0/3 | 0/3 | 2/3 | 0/3 |
| Point to a decision or ask | Claude | 0/3 | 0/3 | 3/3 | 0/3 |
| Point to a decision or ask | Codex | 0/3 | 0/3 | 2/3 | 0/3 |
| Require a user decision before approval | Claude | 0/3 | 0/3 | 3/3 | 0/3 |
| Require a user decision before approval | Codex | 3/3 | 0/3 | 2/3 | 2/3 |

The original and first change missed the missing approval on both hosts. The explicit blocking rule caught it on Codex. Claude still approved all three times. Changes requested solely about buffering or delivery did not count. The adoption criterion is two paired successes per host. Keep the current product rubric.

- replay: $0.72 measured on scored sessions. 4 excluded native timeouts. Extra spend for interrupted calls is unknown.
- explicit-block: $0.75 measured on scored sessions. 1 excluded native timeouts. Extra spend for interrupted calls is unknown.

## Prompt reductions

| Arm | Product revision | Main change | Source lines saved |
|---|---|---|---:|
| handbook | `09cbdfc839` | Remove handbook recap and plan walkthrough | 21 |
| map | `51708d6b91` | Remove second phase map | 15 |
| guide | `a9e78db682` | Consolidate context, checkpoints and examples | 66 |
| combined | `12a51a678f` | All three broad reductions | 102 |
| narrow | `8a870ac977` | Retain configured paths and confirmation safeguards | 29 |
| lean | `c6b1937769` | Handbook, map and narrower intake guide | 65 |

## Author runs

The equipment loan request supplies the rule for an unmatched return and leaves a second loan of the same tool unspecified. The scheduling control supplies the overlap policy. Trials have a shared $3 author/reviewer budget. Results below come directly from the Harbor verifier. Product-plan and question grading are separate.

| Arm | Case | Author | Observed intake outcome |
|---|---|---|---|
| baseline | equipment-loans | claude | passed |
| baseline | equipment-loans | codex | passed |
| bookmark-lean | bookmark-duplicate | claude | passed |
| bookmark-lean | bookmark-duplicate | codex | passed |
| combined | equipment-loans | claude | passed |
| combined | equipment-loans | codex | passed |
| guide | equipment-loans | claude | passed |
| guide | equipment-loans | codex | passed |
| handbook | equipment-loans | claude | passed |
| handbook | equipment-loans | codex | passed |
| lean | equipment-loans | claude | passed |
| lean | equipment-loans | codex | incomplete; see retry |
| lean-retry-codex | equipment-loans | codex | passed |
| map | equipment-loans | claude | passed |
| map | equipment-loans | codex | passed |
| narrow | equipment-loans | claude | passed |
| narrow | equipment-loans | codex | passed |
| owner | equipment-loans | claude | passed |
| owner | equipment-loans | codex | passed |
| shift-combined | shift-specified | claude | downstream_edit |
| shift-combined | shift-specified | codex | passed |
| shift-guide | shift-specified | claude | passed |
| shift-guide | shift-specified | codex | passed |
| shift-handbook | shift-specified | claude | passed |
| shift-handbook | shift-specified | codex | passed |
| shift-lean | shift-specified | claude | passed |
| shift-lean | shift-specified | codex | passed |
| shift-map | shift-specified | claude | passed |
| shift-map | shift-specified | codex | incomplete; see retry |
| shift-map-retry-codex | shift-specified | codex | passed |
| shift-narrow | shift-specified | claude | passed |
| shift-narrow | shift-specified | codex | passed |

## Local evidence

Raw transcripts and native review receipts are private. The Harbor job directory is `experiments/harbor/jobs/intake-3TJD0A` in the infrastructure checkout. Each terminal author trial has its own evidence index after scoring. Selected wording must pass both hosts and local compatibility checks before adoption.


## Compatibility and trial evidence

The broad intake cut failed 27 of 47 targeted checks. It removed the explicit configured glossary and surfaces paths alongside repeated prose. The narrower combination keeps these paths and the single-question safeguards. The same 47 checks all pass.

| Trial | Host | Handoff | Author + reviewer | Review starts | Trial draft PRs observed | Evidence |
|---|---|---|---:|---:|---:|---|
| baseline | claude | passed | $1.77 | 7 | 0 | `baseline/trials/intake-equipment-loans/claude/evidence-index.json` |
| baseline | codex | passed | $0.38 | 1 | 0 | `baseline/trials/intake-equipment-loans/codex/evidence-index.json` |
| bookmark-lean | claude | passed | ≥$1.31 | 8 | 0 | `bookmark-lean/trials/intake-bookmark-duplicate/claude/evidence-index.json` |
| bookmark-lean | codex | passed | $0.52 | 3 | 0 | `bookmark-lean/trials/intake-bookmark-duplicate/codex/evidence-index.json` |
| combined | claude | passed | $0.89 | 2 | 0 | `combined/trials/intake-equipment-loans/claude/evidence-index.json` |
| combined | codex | passed | $0.69 | 2 | 0 | `combined/trials/intake-equipment-loans/codex/evidence-index.json` |
| guide | claude | passed | $1.97 | 6 | 0 | `guide/trials/intake-equipment-loans/claude/evidence-index.json` |
| guide | codex | passed | $0.56 | 2 | 0 | `guide/trials/intake-equipment-loans/codex/evidence-index.json` |
| handbook | claude | passed | $1.67 | 4 | 0 | `handbook/trials/intake-equipment-loans/claude/evidence-index.json` |
| handbook | codex | passed | $0.63 | 2 | 0 | `handbook/trials/intake-equipment-loans/codex/evidence-index.json` |
| lean | claude | passed | $1.80 | 5 | 0 | `lean/trials/intake-equipment-loans/claude/evidence-index.json` |
| lean-retry-codex | codex | passed | $0.62 | 2 | 0 | `lean-retry-codex/trials/intake-equipment-loans/codex/evidence-index.json` |
| map | claude | passed | $1.39 | 10 | 0 | `map/trials/intake-equipment-loans/claude/evidence-index.json` |
| map | codex | passed | $0.76 | 2 | 0 | `map/trials/intake-equipment-loans/codex/evidence-index.json` |
| narrow | claude | passed | $1.07 | 4 | 0 | `narrow/trials/intake-equipment-loans/claude/evidence-index.json` |
| narrow | codex | passed | $0.63 | 2 | 0 | `narrow/trials/intake-equipment-loans/codex/evidence-index.json` |
| owner | claude | passed | $1.13 | 4 | 0 | `owner/trials/intake-equipment-loans/claude/evidence-index.json` |
| owner | codex | passed | $0.60 | 2 | 0 | `owner/trials/intake-equipment-loans/codex/evidence-index.json` |
| shift-combined | claude | downstream_edit | ≥$1.47 | 14 | 0 | `shift-combined/trials/intake-shift-specified/claude/evidence-index.json` |
| shift-combined | codex | passed | $0.43 | 2 | 0 | `shift-combined/trials/intake-shift-specified/codex/evidence-index.json` |
| shift-guide | claude | passed | $0.66 | 5 | 0 | `shift-guide/trials/intake-shift-specified/claude/evidence-index.json` |
| shift-guide | codex | passed | $0.49 | 2 | 0 | `shift-guide/trials/intake-shift-specified/codex/evidence-index.json` |
| shift-handbook | claude | passed | $0.96 | 7 | 0 | `shift-handbook/trials/intake-shift-specified/claude/evidence-index.json` |
| shift-handbook | codex | passed | $0.32 | 1 | 0 | `shift-handbook/trials/intake-shift-specified/codex/evidence-index.json` |
| shift-lean | claude | passed | ≥$0.99 | 8 | 0 | `shift-lean/trials/intake-shift-specified/claude/evidence-index.json` |
| shift-lean | codex | passed | $0.97 | 3 | 0 | `shift-lean/trials/intake-shift-specified/codex/evidence-index.json` |
| shift-map | claude | passed | ≥$1.16 | 10 | 0 | `shift-map/trials/intake-shift-specified/claude/evidence-index.json` |
| shift-map-retry-codex | codex | passed | $0.35 | 1 | 0 | `shift-map-retry-codex/trials/intake-shift-specified/codex/evidence-index.json` |
| shift-narrow | claude | passed | $0.74 | 5 | 0 | `shift-narrow/trials/intake-shift-specified/claude/evidence-index.json` |
| shift-narrow | codex | passed | $0.43 | 2 | 0 | `shift-narrow/trials/intake-shift-specified/codex/evidence-index.json` |

- lean/codex: archived incomplete attempt. RuntimeError: Author invocation failed; see trial trace.

- shift-map/codex: archived incomplete attempt. RuntimeError: Author invocation failed; see trial trace.

## Selection

The broad combination failed on Claude: it edited `src/shifts.ts` before approval. The narrower combination removes 65 source lines. On the supplied scheduling case both hosts recorded the overlap refusal, cleared review and asked zero questions. The five generated surfaces were refreshed and verified. The delivered skill, handbook and intake Markdown match the live trials byte for byte on both hosts. The final package was regenerated from the product checkout. Its bundled dependency paths differ from the private evaluation build; compared with the original product runtime, only managed asset digests changed. The locally prepared candidate is `codex/intake-3tjd0a-ready`; the tested reduction was selected for the local product branch.

The equipment-loan case is recorded in the Harbor runbook at harness commit `de1531495`. The archived private trials used the shared CSV starter package. Both revisions received the same starter. The reusable fixture has its own package name.

All 16 authors asked about an existing borrower. The operator approved refusing the second checkout and preserving the borrower until return. One human decision answered 16 separate clarification checkpoints. A second human decision answered four tool-name questions. The relay sent the answer to each original session. The reusable host-side answer key and decision catalog are in harness commit `6f0e98bc4`.

All 16 fresh-feature plans received independent approval before downstream edits. Both approved operator answers are saved for replay. The name-matching answer is in harness commit `25bb321d7`.

Four Claude trials asked how to identify a tool. The operator approved case-insensitive matching, trimming leading and trailing spaces, and collapsing repeated spaces between words for both lending and returns. All four approved plans record that policy. The other twelve trials finished before it was supplied and were graded against their original inputs. The map-only Codex author also asked to confirm its proposed storage-error behavior. The coordinator confirmed that a failed operation reports the error, preserves existing loans and does not claim success.

On the bookmark regression both authors asked about saving an existing label and used the previously recorded decision. Both approved plans preserve the original URL.
