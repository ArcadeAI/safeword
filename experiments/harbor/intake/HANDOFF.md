# Reproduce an intake handoff comparison

Use this protocol when changing how Safeword takes an ordinary feature request through independent Product Plan approval. The [Harbor suite guide](../README.md) covers implementation, TDD, and end-to-end benchmarks. Start from its existing fixture and scorecard for those questions.

For eval authors, the [LLM Evals Guide](../../../packages/cli/templates/guides/llm-evals-guide.md) explains how to grade observable behavior from traces. When comparing skill wording, use the [Skill-Eval Optimization Guide](../../../packages/cli/templates/guides/skill-eval-optimization-guide.md) for repeated trials and verification in the actual agent hosts. Keep both guides on the evaluator side so the feature request stays blind.

## Before spending money

1. Name the single change and the failure it should fix. Replay the original trace. A correct draft and an edit made before independent approval must earn separate grades. Keep the motivating failure outside the new sample.
2. Choose the two product revisions and record a fresh feature request and its observable success criteria in a private plain-text file. Keep process instructions and the answer key out of every user prompt. The café waitlist is now a known regression fixture. Choose a different feature for an unseen test.
3. From `experiments/harbor`, use the account setup in the [intake runner](README.md). Set `BASELINE` and `CANDIDATE` to Git revisions, `JOB` to a new path under `jobs/`, and `HOLDOUT` to your private file. Then run:

```sh
mkdir -p jobs
uv run --locked python resolve_comparison.py "${JOB}-models.json" --author opus --claude-reviewer opus
uv run --locked python -m intake.handoff prepare "$JOB" \
  --baseline "$BASELINE" --candidate "$CANDIDATE" \
  --comparison "${JOB}-models.json" --holdout "$HOLDOUT"
```

Preparation creates `protocol.json` and the fixtures without starting either author. Inspect the model IDs, CLI versions, prices, product revisions and prompt in the prepared job. Both arms use the same host-side grader model, policy and answer key. The run verifies input fingerprints before starting a trial. If the harness checkout was dirty when prepared, reproducing it also requires the recorded file contents.

## Run and resume

```sh
uv run --locked python -m intake.handoff run "$JOB"
uv run --locked python -m intake.handoff grade "$JOB"
uv run --locked python -m intake.handoff_report "$JOB" > "$JOB/scorecard.md"
```

The shift scheduling comparison runs the supplied overlap rule three times and the hidden rule once per author and template. That makes 16 fresh workspaces. Each has a $3 shared author and reviewer budget. Grading and routing have separate receipts. Live author runs and uncached product grading are on demand. The last command reads saved evidence offline.

The runner prints each trial’s relay directory. Monitor it during execution. Routine approvals and known answers are handled automatically. Forward any outstanding `*-operator.md` decision to the user, save their reply, and resume the same trial. For mixed requests, answer only the outstanding clauses. Record who chose a newly clarified policy and when. Add reusable decisions to the host-side catalog for future runs. Grade older trials against what was known at the time. See [relay details](README.md#pilot-automatic-product-decisions).

Re-running `run` skips finished trials. Inspect a partial trial before resuming. Keep the original evidence. If the runner or meter interrupted a trial, grade it first, then use the recorded group and author to run its replacement:

```sh
uv run --locked python -m intake.handoff retry "$JOB" baseline-hidden-1 codex
uv run --locked python -m intake.handoff grade "$JOB"
uv run --locked python -m intake.handoff_report "$JOB" > "$JOB/scorecard.md"
```

Workflow failures and reaching the actual dollar cap count in the comparison. Retries preserve the original attempt’s spend. A missing receipt makes spend a lower bound. An incomplete or conflicting measurement needs investigation before a promotion decision.

## Decide and capture the result

A primary success requires a correct plan **and** independent approval before scenarios or code. Check each author separately. Promote a candidate to a fresh-feature check only if it improves supplied-case successes, preserves each host’s baseline success count, and preserves useful clarification on the hidden case without increasing repeated or already-answered questions. A tie favors the current version. Report useful questions, repeat questions, operator interruptions, reviewer activity, and total author-plus-reviewer cost per success alongside those counts.

The 16 trials cover shift scheduling. Preparation saves the holdout plan for a separate run. Before adopting a change, use the [single-trial runner](README.md) to test that reserved feature against its criteria on both hosts with both versions and the same frozen comparison snapshot. An advance applies only to the phase measured. Record the result, exact revisions, host counts, known-cost bounds and missing evidence in the PR or tracked experiment notes. Keep raw transcripts and private job files local. Check the evidence index for draft PRs and close any drafts created by the trials.

When reviewer counts differ, run this on each author’s trial directory:

```sh
uv run --locked python -m intake.review_rounds "$LANE"
```

Count reviewer process starts, distinct jobs, independent verdicts, changes requested, failed routes and approvals separately. Look up the first occurrence of a repeated finding, subsequent plan edits, and the corresponding user exchange. To isolate reviewer behavior in a new experiment, give both reviewers the same frozen plan and context.

In the café run the Claude author had 12 reviewer starts across 11 jobs. Codex issued nine requests for changes and one independent approval. Two launches failed. Four consecutive reviews concerned the risk of a party disappearing between removal and announcement. The Codex author received one approval from Claude, which deferred similar risks to scenarios. Both the plan and the reviewer varied in that comparison.

In a follow-up, Claude Opus 5.5 and Codex GPT-6.2 Sol each reviewed the same two archived café plans once, using the native Product Plan rubric at product revision `904e78010`. Before the user chose a crash policy, Claude approved removal before announcement. Codex blocked it because an interruption could silently lose the first party. After the user chose announcement first, both accepted that choice and identified the same risk of a stale lock. Claude deferred recovery to a scenario because the plan already promised that the next call would work. Codex requested an explicit rule that normal service resumes. This distinction is worth grading separately from the overall approval.

For a paired replay, verify each reconstructed packet’s target and planning-context identity against its original review receipt before dispatch. Record excluded attempts and spend. This comparison used four scored reviews ($0.38 estimated) and excluded four setup reviews ($0.39) after detecting a duplicated surface definition in reconstructed context.

A follow-up A/B test replaced the paragraph on unspecified details with guidance to ask who should choose the failure outcome and move verification of an accepted promise to scenarios. Each model reviewed each saved café plan three times per wording (24 reviews, $1.26 estimated). Claude approved the unresolved plan in all three candidate runs. Codex blocked all three on possible loss of the party or its place after a failed announcement, but none of those candidate findings explicitly caught termination between removal and announcement. Once the user had chosen, each model approved 3/3 with the original wording and 2/3 with the candidate. Keep the original rubric. When replaying this case, grade the silent-loss finding separately from an overall rejection about the queue being busy.

To test whether the reviewer knows who chose a policy, use a directional pair. Hold the plan, ticket, rubric and other project evidence fixed. Remove claims in authored artifacts that the user approved the policy. Change only the presence of the user's actual reply in the request context, and assert that the decoded packets otherwise match. Grade whether the reviewer requires confirmation of that specific choice separately from its overall verdict. This follows the [CheckList behavioral testing method](https://aclanthology.org/2020.acl-main.442/).

In the café decision-source test, the plan proposed announcing first and tolerating a repeat call. Across three trials per host and condition, neither Claude nor Codex required confirmation when the preference was missing (0/6). With the user's reply present, nobody reopened the decision and five of six plans passed. Codex blocked once in each condition over when an announcement reaches the output stream. That finding earns no clarification credit. These 12 reviewer-only trials cost an estimated $0.75 and cover one policy.
