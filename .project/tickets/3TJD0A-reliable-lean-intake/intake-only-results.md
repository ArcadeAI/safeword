# Intake-only follow-up results

Adopt the six corrected starter templates. Keep the current checkpoint, guide-loading, and independent-review instructions. Each matched author used a fresh Harbor workspace, the frozen Opus 5.5 / GPT-6.2 Sol comparison and a $3 author-plus-reviewer cap. Each host had one trial per author condition; the frozen reviewer replay used three repetitions.

## Decisions

- **Keep the current discovery text.** The prose-only version passed both authors on the supplied request. Combining it with template and conversation cuts still led Claude to edit a production file before approval. The six initial deterministic failures included loss of the explicit empty-context instruction. The narrower combined candidate repaired the contract checks but still missed the live gate. [Ticket PH91BA](../PH91BA-concise-intake-guide/ticket.md)
- **Adopt the corrected starter templates.** The first template version lost the automatic, explicit and legacy persona-code bounds and Claude started downstream work early. Restoring the code bounds while keeping short examples gave 8/8 approved handoffs on both authors across hidden and supplied bookmarks, linked children and shifts. The six templates shrink from 1,454 to 1,005 whitespace-delimited words (449 fewer, 30.9%). [Ticket J97V67](../J97V67-concise-intake-templates/ticket.md)
- **Keep the existing confirmation guidance.** Across the standalone hidden and supplied cases, each host had one product-question turn when the decision was missing and zero when supplied, for both versions. Original Claude bundled a routine persona-name approval into its hidden question. On the corrected child case, baseline had zero checkpoints on both hosts; candidate Claude asked for one additional approval, while Codex asked none. Both versions preserved the required duplicate policy. [Ticket AWECEC](../AWECEC-fewer-intake-pauses/ticket.md)
- **Keep the current planning-guide trigger.** Fresh Codex dropped from two identifiable planning-guide read commands to zero, but input rose from 472,981 to 530,576 tokens. Fresh Claude had no identifiable read in either arm. All four matched repair runs passed; Codex still read the guide in both. This sample does not establish consistent input savings. Stale implementation-plan resumes were outside the intake boundary. [Ticket GF2EF8](../GF2EF8-focused-planning-reference/ticket.md)
- **Keep the existing coordinator route.** The direct-route author trials passed all four gates, with 10 native review calls across the four trials compared with 19 on baseline. The reviewer rubric was byte-identical. In the separate frozen café replay both hosts approved all three missing-decision plans and all three supplied-decision plans. Neither host met the two-of-three paired correctness criterion. A shorter route cannot take credit for improving that distinction. [Ticket PEA6ZB](../PEA6ZB-direct-intake-review/ticket.md)
- **Retain the intake triggers.** Verified the demand-research and cold-start contracts in the repository suite and checked that Discovery links scenarios after the saved phase transition. These are deterministic guidance and contract checks. Specialist guide bodies and downstream planning were outside scope. [Ticket P4H33N](../P4H33N-conditional-intake-guides/ticket.md)
- **Keep the current intake conversation guidance.** Deleting only the conversation-technique menu passed the supplied bookmark case on both hosts. Input was lower on Claude and higher on Codex. The combined version had a premature edit. Later workflow and resume tables were excluded per scope. [Ticket ZX3EEA](../ZX3EEA-single-bdd-phase-map/ticket.md)

## Trial evidence

44 valid installed-plugin author trials yielded 42 intake gate passes. Both failures involved Claude starting downstream work before independent approval. The frozen reviewer replay added 12 verdicts. The 12 original child and repair attempts were excluded because their parent promised an existing version command that was absent from the starter. The corrected fixture includes the original version command and reruns every affected comparison. An excluded run has no weight in the decisions. No draft PR creation receipts were reported.

The 44 valid author trials cost an estimated $25.89 for authors and reviewers. That subtotal excludes the discarded fixtures, separate routing calls and frozen review replay. The gate verifies a current independent approval, the same feature ticket advancing, and no early scenario or implementation edit. A gate pass alone does not grade every sentence in a plan.

| Candidate and fixture | Host | Gate | Relay checkpoints | Reviewer calls | Author input tokens | Traced planning-guide reads¹ | Estimated spend |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| base-child-fixed | claude | passed | 0 | 3 | 883,139 | 0 | $0.61 |
| base-child-fixed | codex | passed | 0 | 1 | 422,436 | 0 | $0.34 |
| base-hidden | claude | passed | 1 | 6 | 1,296,890 | 0 | $1.17 |
| base-hidden | codex | passed | 1 | 2 | 1,043,864 | 1 | $0.59 |
| base-repair-fixed | claude | passed | 0 | 2 | 893,226 | 0 | $0.51 |
| base-repair-fixed | codex | passed | 0 | 1 | 543,000 | 3 | $0.33 |
| base-shift | claude | passed | 0 | 6 | 1,245,731 | 0 | $0.79 |
| base-shift | codex | passed | 0 | 2 | 889,512 | 2 | $0.56 |
| base-supplied | claude | passed | 0 | 10 | 1,528,000 | 0 | $1.06 |
| base-supplied | codex | passed | 0 | 1 | 472,981 | 2 | $0.28 |
| pauses-child-fixed | claude | passed | 1 | 1 | 870,053 | 0 | $0.98 |
| pauses-child-fixed | codex | passed | 0 | 2 | 905,210 | 2 | $0.54 |
| pauses-hidden | claude | passed | 1 | 2 | 1,221,958 | 0 | $0.94 |
| pauses-hidden | codex | passed | 1 | 1 | 959,024 | 1 | $0.34 |
| pauses-supplied | claude | passed | 0 | 3 | 681,186 | 0 | $0.49 |
| pauses-supplied | codex | passed | 0 | 2 | 942,590 | 3 | $0.48 |
| planning-repair-fixed | claude | passed | 0 | 4 | 827,380 | 0 | $0.59 |
| planning-repair-fixed | codex | passed | 0 | 1 | 440,100 | 3 | $0.28 |
| planning-supplied | claude | passed | 0 | 5 | 1,251,931 | 0 | $0.73 |
| planning-supplied | codex | passed | 0 | 1 | 530,576 | 0 | $0.33 |
| prose+contextfix+templates+codefix+tips-child-fixed | claude | passed | 0 | 1 | 651,197 | 0 | $0.40 |
| prose+contextfix+templates+codefix+tips-child-fixed | codex | passed | 0 | 1 | 437,534 | 2 | $0.33 |
| prose+contextfix+templates+codefix+tips-hidden | claude | passed | 1 | 3 | 1,163,093 | 0 | $0.95 |
| prose+contextfix+templates+codefix+tips-hidden | codex | passed | 1 | 2 | 1,388,692 | 0 | $0.52 |
| prose+contextfix+templates+codefix+tips-supplied | claude | downstream_edit | 0 | 0 | 89,040 | 0 | $0.14 |
| prose+contextfix+templates+codefix+tips-supplied | codex | passed | 0 | 3 | 1,440,191 | 2 | $0.66 |
| prose-supplied | claude | passed | 0 | 4 | 1,105,215 | 0 | $0.64 |
| prose-supplied | codex | passed | 0 | 2 | 884,311 | 2 | $0.46 |
| review-hidden | claude | passed | 1 | 4 | 1,220,389 | 0 | $1.01 |
| review-hidden | codex | passed | 1 | 1 | 912,589 | 1 | $0.33 |
| review-supplied | claude | passed | 0 | 4 | 1,103,735 | 0 | $0.68 |
| review-supplied | codex | passed | 0 | 1 | 695,546 | 0 | $0.29 |
| templates+codefix-child-fixed | claude | passed | 0 | 4 | 799,780 | 0 | $0.61 |
| templates+codefix-child-fixed | codex | passed | 0 | 2 | 711,127 | 1 | $0.52 |
| templates+codefix-hidden | claude | passed | 1 | 4 | 831,073 | 0 | $0.91 |
| templates+codefix-hidden | codex | passed | 1 | 4 | 2,110,700 | 2 | $0.96 |
| templates+codefix-shift | claude | passed | 0 | 3 | 1,049,173 | 0 | $0.61 |
| templates+codefix-shift | codex | passed | 0 | 2 | 870,449 | 1 | $0.56 |
| templates+codefix-supplied | claude | passed | 0 | 3 | 1,057,840 | 0 | $0.58 |
| templates+codefix-supplied | codex | passed | 0 | 3 | 993,051 | 1 | $0.64 |
| templates-supplied | claude | downstream_edit | 0 | 0 | 408,427 | 0 | $0.28 |
| templates-supplied | codex | passed | 0 | 2 | 1,146,423 | 2 | $0.47 |
| tips-supplied | claude | passed | 0 | 6 | 889,002 | 0 | $0.70 |
| tips-supplied | codex | passed | 0 | 3 | 1,642,964 | 1 | $0.71 |

¹ Explicit file reads and recognizable shell reads naming the guide. Wildcards or paths inside helper programs can be missed. Author input includes cached tokens, counts repeated context on successive calls, and excludes reviewer inputs. Relay checkpoints measure turns passed to the relay, including automatic answers.

## Reproduce and inspect

Product baseline: `1cf7846f6`. In the Harbor infrastructure worktree, the private directory `experiments/harbor/jobs/intake-value/` contains the build and trial drivers, frozen fixture inputs, observations, per-trial indices and raw traces. Use `report.py` from that directory with `experiments/harbor` on PYTHONPATH to reconstruct the table. Candidate patches and Git revision identities are retained there. Evaluation worktrees use local native account credentials. The answer key stayed outside the agent workspaces.

Candidate revisions:

- `pauses`: `59cd4f1dcdcc`.
- `planning`: `eb75f7c9f0f0`.
- `prose+contextfix+templates+codefix+tips`: `a443fdbdfa8d`.
- `prose+templates+tips+planning`: `b5490508a6bb`.
- `prose`: `635eaf1c9226`.
- `review`: `97b1947e12d8`.
- `templates+codefix`: `d0a17d44b316`.
- `templates`: `44a4bee3c2e8`.
- `tips`: `466aa1bb9736`.

## Repository verification

All 770 CLI test files passed against the selected template source (12,353 tests passed, 14 skipped). The product checkout independently passed the 142 focused checks in 12 files. All five generated surfaces passed the freshness check, and the shipped Claude and Codex bundle trees matched the selected Harbor revision.
