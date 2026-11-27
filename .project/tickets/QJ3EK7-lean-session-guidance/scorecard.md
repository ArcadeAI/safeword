# Session handbook decisions

The always-loaded source fell from 3,663 to 3,128 whitespace-delimited words (535 fewer, 14.6%). The detailed architecture and stale-plan procedures remain available on demand. No hook, BDD skill or intake gate was removed.

| Instruction | Decision | What we observed |
| --- | --- | --- |
| Restate every turn. Apply typography tips and copy stock examples. | Remove. Keep using confirmed decisions, asking about open choices, and the exact handoff format. | In the isolated supplied-answer probe, Codex went from 21 to 18 words and Claude from 51 to 118. In the open recommendation, Claude went from 438 to 394 and Codex from 113 to 97. The saving is in the handbook. The runs do not establish consistently shorter replies. |
| Six generic coding anti-pattern examples | Remove. Keep the explicit error and simplicity rules. | With only the table removed, both agents wrote a failing test, narrowed the exception handler to missing files, and passed the hidden checks for a missing file, a valid file and a directory. The combined handbook also passed on both. No unrelated production change appeared. |
| Three-bullet Build recap | Remove. Preserve the opening route and explicit overrides. | With just the recap removed, both agents ran a red test before the bug fix and a green test afterward. Both corrected only the misspelling in the mechanical case and verified the output. The installed-plugin feature result is below. |
| Four architecture decision steps | Move the detail to the architecture guide. Keep a trigger in the handbook. | Both hosts recorded a design preserving the two released clients, alternatives, tradeoffs and reversal. In the combined Codex run the agent read the guide via a shell wildcard. Counting only named file opens would have missed it. Typo controls did not produce an architecture record. These are outcome checks. The focused workspace did not install the brainstorming skill. |
| Stale-plan review | Keep consent **and independent worktree review** in the handbook. Move the procedure to the planning guide. | A pointer-only version yielded a correct Codex verdict without observable independent review. With the explicit requirement restored, Claude requested an isolated reviewer in 3/3 accepted runs. Codex showed both collaboration and an isolated checkout in 2/3. Both hosts honored all six refusals combined and left the ticket untouched. A verdict alone does not prove isolation. |
| Literal Next/Need/Open handoff | Keep. | The handoff parser and associated contract tests passed. The wording is consumed by software. |

## Installed-plugin feature intake

These Harbor trials used separate repositories and the real opposite-host independent reviewer. The success condition was a current reviewed Product Plan and a saved move past intake before any scenario or implementation edit. Hidden and supplied preferences are scored separately from workflow compliance.

| Fixture | Original Claude / Codex | Candidate Claude / Codex | Observation |
| --- | --- | --- | --- |
| Fresh bookmark CLI, duplicate policy hidden | Pass / pass | Pass / pass | All four asked once and saved the answer to refuse duplicates. First checkpoint word counts went from 294 to 341 on Claude and 111 to 94 on Codex. |
| Fresh shifts CLI, overlap policy supplied | Pass / pass | Pass on retry / pass | Claude asked if adjacent shifts count as overlapping. This is a new boundary question. It does not count as asking the operator to repeat the overlap rule. |
| Existing one-file bookmark CLI, duplicate policy hidden | Early scenarios / pass | Pass / pass | Both Codex trials and the candidate Claude trial cleared the independent gate. Original Claude wrote a scenario file before approval. |
| Existing one-file bookmark CLI, duplicate policy supplied | Early scenarios / pass | Pass / pass | The original Claude author wrote a scenario file before approval. Neither candidate re-asked the supplied duplicate rule. |

The final candidate cleared the one-file gate in 4/4 trials versus 2/4 for the original. Both original Claude trials invoked the BDD skill, then skipped independent approval before writing scenarios. Skill invocation alone would have scored both failures as successes. On the final candidate, Claude used 9 reviewer calls ($1.49 total) for the hidden preference and 13 ($1.25) for the supplied preference. Codex used 1 ($0.29) and 2 ($0.51). Counts are reviewer invocations, not distinct findings.

The fresh fixture compared the original to the first combined candidate. The one-file fixture compared the original to the final candidate with the explicit independent-worktree reminder. Use the matched pairs to interpret these results. One trial per host, fixture and version can reveal a failure but cannot establish a reliable win rate. The frozen comparison used Claude Opus 5.5 and Codex GPT-6.2 Sol with a $3 cap per trial.

## Reproduction and evidence

Infrastructure commit `cb225bae5` contains the replay commands. The infrastructure branch's `experiments/harbor/handbook/README.md` explains both entry points. Focused probes load the handbook and its two guides using the native host, without installing the Safeword plugin. Real Harbor intake installs the product archive and uses the regular approval and phase observers. Skills, guide reads, user questions, URLs and tool failures are captured as far as the respective traces expose them. A string in a prompt or command is not proof a skill ran or a URL was visited.

- Product baseline: `7f81e19c0`. Initial combined archive: `2c690458b`. Final combined archive: `b307e1bf9`.
- Private intake evidence: `experiments/harbor/jobs/intake-3TJD0A/{bookmark,shift}-handbook2-{base,candidate}` and `jobs/QJ3EK7-one-file`. Each finished comparison writes a result table and an evidence index per host. Scored failures remain visible.
- Focused evidence: `jobs/QJ3EK7-probes` (20 combined and baseline trials), `jobs/QJ3EK7-isolated` (10 single-change trials), `jobs/QJ3EK7-prose` (8 wording trials), `jobs/QJ3EK7-resume-{1,2,3}` (24 consent trials). Estimated focused-model spend was $7.85 over 62 trials. Exact source patches and revision IDs for the single-change variants are saved in `jobs/QJ3EK7-isolated/*.patch` and `revisions.json`.
- The bug verifier initially failed to create its temporary test directory in a read-only container. Supplying a temporary filesystem and replaying the verifier on the same four saved patches passed. No additional author calls were charged for this correction.

All 78 planned trials have scored outcomes. The 16 scored intake runs used $11.83 in estimated author and reviewer spend, plus $7.85 for the 62 focused trials. This excludes decision routing and two interrupted Claude attempts. Both interruptions reported DNS error EAI_AGAIN. Their logs show at least $1.35 in spend, with incomplete reviewer pricing on the first retry. No completed intake trial reported creating a draft PR.

The operator approved adjacent shifts for the same employee. The answer key is in harness commit `026ee21a3`. The final Claude trial reused the approved answer when asked in different words. Its independently approved plan explicitly allows a 17:00 handoff and rejects shifts sharing working time. It passed before scenario or implementation edits, with three reviewer calls and $1.17 estimated spend. The trace and plan are in `jobs/intake-3TJD0A/shift-handbook2-candidate-retry2-claude`.

## Repository verification

All five generated product surfaces passed their freshness check. In the complete CLI test run, 763 of 770 test files passed and seven hit timeouts in setup, reset, hook or OpenCode checks. Re-running all seven together with the five affected handbook and contract suites passed all 239 tests in 12 files. The first full-suite attempt had been interrupted during regeneration and was excluded.
