# Intake verification

**PR Scope:** ✅ The branch delivers the intake routing, review handoff, and prompt reductions evaluated in this epic. The changes to both plugins, the installed guides, and the CLI reference carry the same behavior to their respective consumers. The experiment records preserve the decisions to keep or revert each candidate.

| Check | Evidence |
| --- | --- |
| Test suite | The promoted implementation passed 105 focused tests, including the three contract checks that rejected the broader candidate. The full Node 22 and Node 24 results are recorded in the [PR checks](https://github.com/ArcadeAI/safeword/pull/8398/checks). |
| Gherkin | The epic defines behavioral experiments and adoption thresholds in its scorecards. The repository's separate acceptance suite runs under the full verification workflow. |
| Build and lint | Both packaged CLI entry points created a new feature ticket in separate empty Git repositories. The generated-surface check passed for all five surfaces. Dogfood parity passed for 277 mirror pairs and 11 contracts. CI records lint, type checking and the CLI contract. |
| Scenarios | In three fresh trials on the promoted plugin, the CLI and web requests named their first interface and reached independent approval. The internal refactor preserved its outputs and left the interface inventory empty. Estimated combined cost was $2.20. |
| Independent review | Claude approved the intake sources through the quality-review coordinator in job `05b65646-f791-48a9-a86d-953fb058adef`. The PR records each advisory finding and its disposition. |
| Refactor and dependency drift | The handoff shares existing review provenance, locking and phase checks. The branch changes no package manifests or lockfiles. |
| Parent and delivery checklist | This is the evaluation epic. Its children record their own adoption decisions. The epic has no feature Execution Plan checklist. |

## Experience and limits

A maintainer can trace the decision to retain the existing reviewer wording to the café plan, its missing user decision, and separate Claude and Codex verdicts in the [scorecard](./scorecard.md). Both runtime scaffolds point the author to register the first interface. The slowest step for an author remains obtaining independent review. The template change adds no confirmation prompt.

The promoted bundle had one trial per interface case. An earlier blind Claude trial edited implementation before review, and an earlier Codex trial used the general review route for a hand-written ticket. The scorecards preserve both outcomes. The CLI checks the reviewed content when advancing the ticket. A separate editor can still modify files during the final write.
