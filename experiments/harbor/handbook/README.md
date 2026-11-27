# Handbook comparisons

Use a fresh output directory for each invocation. Choose one frozen comparison snapshot from the intake runner. Keep the old and proposed product commits available locally. Both commands run on demand and use the same models and rates in both arms. Set up the local Claude and Codex accounts as described in the [intake runbook](../intake/README.md). Use the [project eval guide](../../../packages/cli/templates/guides/llm-evals-guide.md) to choose the scope.

## Real feature intake

From `experiments/harbor`, run the two installed plugins on an existing one-file CLI. The user either specifies the duplicate-label policy or leaves it open. The answer key, independent reviewer, dollar supervision and phase observer are the normal Harbor intake components.

```sh
SAFEWORD_EVAL_DECISIONS=1 SAFEWORD_EVAL_DECISION_MODEL=claude-sonnet-5-5 \
uv run --locked python -m handbook.intake --base "$BASE_REV" --candidate "$CANDIDATE_REV" \
  --comparison "$COMPARISON" --out jobs/handbook-intake
```

This exploratory comparison records fixture hashes for inspection and uses the current answer key. Use the frozen handoff protocol for adoption decisions. This comparison grades the intake gate automatically. Check whether the plan honored the preference during the manual review. Inspect the first clarification before its response, the final plan, the independent approval and the first downstream edit. A question about a new choice goes to the operator. A zero reward can be a genuine workflow failure. Keep it in the results.

## Focused handbook checks

Use the immutable local Docker image ID from the comparison environment. This comparison loads the handbook as the host instruction file and supplies the two guides inside a fresh repository. It isolates the text from plugin hooks. Use the installed-plugin trial above for gate claims.

```sh
uv run --locked python -m handbook.probes --base "$BASE_REV" --candidate "$CANDIDATE_REV" \
  --comparison "$COMPARISON" --image "$IMAGE" --out jobs/handbook-probes
```

Select individual cases with repeatable `--case`. For a small behavior change, score the actual failing regression before the production edit, the green rerun and the hidden verifier. For a typo, check output and the diff. For architecture, inspect the written decision, clients protected, alternatives and reversal. For a stale plan, check whether the author reviewed the changed file, involved another agent in a separate worktree and edited the ticket. Inspect actual tool calls. A correct verdict or a claim of delegation alone earns no independence credit. Repeat both consent directions when moving that requirement. All cases use a $3 cap per host and arm.

Each focused trial keeps its raw tool trace, usage, errors, tracked diff and new file list under `log/` beside its workspace. The full intake runner writes an evidence index for each host. Keep raw trial output private. Record the cases, outcomes, failures, spend and revision decisions in the owning epic.
