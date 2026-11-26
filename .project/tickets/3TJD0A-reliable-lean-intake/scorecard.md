# Intake evaluation scorecard

Baseline product `904e78010`. Claude Opus 5.5 and Codex GPT-6.2 Sol, using frozen CLI versions and prices. Intake success requires a correct plan, independent approval and no premature edits. A correct guess receives no clarification credit.

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
| baseline | equipment-loans | claude | awaiting a reply |
| baseline | equipment-loans | codex | awaiting a reply |
| bookmark-lean | bookmark-duplicate | claude | passed |
| bookmark-lean | bookmark-duplicate | codex | passed |
| combined | equipment-loans | claude | awaiting a reply |
| combined | equipment-loans | codex | awaiting a reply |
| guide | equipment-loans | claude | awaiting a reply |
| guide | equipment-loans | codex | awaiting a reply |
| handbook | equipment-loans | claude | awaiting a reply |
| handbook | equipment-loans | codex | awaiting a reply |
| lean | equipment-loans | claude | awaiting a reply |
| lean | equipment-loans | codex | incomplete; see retry |
| lean-retry-codex | equipment-loans | codex | awaiting a reply |
| map | equipment-loans | claude | awaiting a reply |
| map | equipment-loans | codex | awaiting a reply |
| narrow | equipment-loans | claude | awaiting a reply |
| narrow | equipment-loans | codex | awaiting a reply |
| owner | equipment-loans | claude | awaiting a reply |
| owner | equipment-loans | codex | awaiting a reply |
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
| bookmark-lean | claude | passed | ≥$1.31 | 8 | 0 | `bookmark-lean/trials/intake-bookmark-duplicate/claude/evidence-index.json` |
| bookmark-lean | codex | passed | $0.52 | 3 | 0 | `bookmark-lean/trials/intake-bookmark-duplicate/codex/evidence-index.json` |
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

The broad combination failed on Claude: it edited `src/shifts.ts` before approval. The narrower combination removes 65 source lines. On the supplied scheduling case both hosts recorded the overlap refusal, cleared review and asked zero questions. The five generated surfaces were refreshed and verified. Runtime bundle bytes match the live-tested version. The locally prepared candidate is `codex/intake-3tjd0a-ready`; the active product still uses the baseline.

The equipment-loan case is recorded in the Harbor runbook at harness commit `de1531495`. The archived private trials used the shared CSV starter package. Both revisions received the same starter. The reusable fixture has its own package name.

16 equipment-loan author trials have asked about the existing borrower. The unmatched-return rule is present in the user request. An unanswered question leaves each fresh-feature handoff pending.

On the bookmark regression, both authors asked about saving an existing label, used the saved answer and obtained independent approval. Both plans preserve the original URL. Codex also reported a pending review and resumed it. On the equipment-loan request, only an operator can settle the borrower policy. The test counts these questions as clarification and holds final grading until after the answer and independent approval.
