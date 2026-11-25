# Intake-only comparisons

Harbor starts a fresh Docker workspace for each author. Claude and Codex install the selected Safeword commit as a native plugin. Each uses the other provider to review the plan. The observer stops the author at scenario definition or the first observed downstream edit. Each trial has a shared author and reviewer dollar budget. The 60-second grace period applies after Claude emits a terminal result. Provider usage arrives after work is performed, so the last reported request can cross the budget.

Run from `experiments/harbor` with Docker, Git, uv, and the signed-in Claude and Codex CLIs. Use local account credentials as described in the [comparison setup](../README.md). Set `CLAUDE_CODE_OAUTH_TOKEN` in the environment and `SAFEWORD_EVAL_CODEX_REVIEW_AUTH` to the Codex account's auth file. Use trusted fixtures and plugin revisions because the agent processes can use these credentials. Jobs contain private transcripts and stay local. The observer and author share the container; this measures ordinary agent behavior and assumes the author leaves the measurement files intact.

```sh
mkdir -p jobs
uv run --locked python resolve_comparison.py jobs/intake-models.json --author opus --claude-reviewer opus
uv run --locked python -m intake.run prepare jobs/csv-intake --comparison jobs/intake-models.json --revision HEAD
uv run --locked python -m intake.run trial jobs/csv-intake claude intake-csv-keep --budget 3
```

Run the other three combinations of `claude` or `codex` with `intake-csv-keep` or `intake-csv-discard` against the same prepared comparison. These are four separately launched trials. The frozen model and price snapshot is shared by both hosts. The runner refuses to reuse a trial directory. Use a new comparison directory for another repetition.

The CSV request leaves partial output unspecified. Reveal keep or discard only in response to a question specifically about earlier valid rows when stopping. The saved answer key stays on the host. Watch `jobs/csv-intake/trials/<case>/<host>/relay/` while the trial runs. The coordinator forwards unanswered decisions to the user and saves the reply using the [human relay format](../README.md#human-input). Previously recorded answers match by case. An operator must be present for new questions.

To evaluate parcel identification, prepare another comparison with `--task parcel`. The `--task parcel-specified` control supplies the recipient and collection rules in the request. Use the `intake-parcel-shelf` answer-key case for either. A trusted custom Harbor task directory can also be supplied with `--task PATH`. It must create a Git workspace at `/app`, provide the pinned Claude and Codex CLIs plus the QA tools used by the actor, and emit the same intake verifier files as the shipped task. Use `SAFEWORD_EVAL_ANSWER_KEY` to select a different host-side JSON key. To begin from a saved plan, put the starting project in the custom task image and supply the continuation request in its `instruction.md`.

```sh
uv run --locked python -m intake.score jobs/csv-intake --expect-case intake-csv-keep --expect-case intake-csv-discard
```

Replay reads saved evidence and costs no model calls. Open `intake-results.md` for the handoff result, estimated spend, and review count. Each lane has an evidence index with observed errors, tool usage, trace-visible URLs, relay exchanges and phase history. Codex shell inputs show referenced files and URLs. For passed lanes, the indexed plan belongs to the same ticket as the approval. Missing evidence or a stale plugin identity produces an incomplete row and a nonzero scoring exit. A well-recorded failed trial still counts as a completed measurement.

Judge the product outcome separately. Read the first question before its answer to establish whether the author elicited the decision. Read `final-plan.md` to see whether the plan honored it. A correct guess, a direct clarification, and an independently approved plan are three distinct observations.
