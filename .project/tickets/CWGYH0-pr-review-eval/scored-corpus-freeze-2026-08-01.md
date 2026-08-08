# Scored retrospective benchmark freeze

**Frozen:** 2026-08-01 Pacific time, before any scored-corpus model call.

## Decision question

Does the full correctness reviewer recover the frozen, executable post-cutoff
defects more reliably than the narrow changed-line-only reviewer, without
asserting a defect on its certified fixed twin or producing another directly
falsified finding?

The full reviewer is system A. The narrow reviewer is system B. They share the
same verifier, model, runner, tools, limits, corpus, and randomized execution
order. Only the correctness prompt differs.

## Model and contamination boundary

- Provider: Anthropic.
- Fixed model ID: `claude-sonnet-5`.
- Effort: `high`. Sonnet 5's API default is high; Anthropic documents explicit
  high and omission as exactly equivalent.
- Model training cutoff: January 2026.
- Corpus admission cutoff: `2026-01-31T00:00:00.000Z`; the earliest buggy PR
  head is 2026-02-03.
- Model-ID and cutoff sources: Anthropic's
  [model overview](https://platform.claude.com/docs/en/about-claude/models/overview)
  and [model versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions).

The development prompts originally named Opus 5. That model's May 2026
training cutoff would invalidate 36 of 40 cases. No holdout model call had
occurred when this was discovered. Both systems were therefore frozen on
Sonnet 5, whose January cutoff preserves the post-model-cutoff guard. This
benchmark validates the Sonnet 5 reviewer system, not the Opus 5 system.

Neither a clean merge nor human silence appears anywhere in the machine label.
The positive is a deterministic failure on the buggy snapshot. The negative is
only the same failure's deterministic absence on the minimal fixed twin.

## Frozen corpus

| Artifact | Cases | SHA-256 |
| --- | ---: | --- |
| `scored-cases-frozen-2026-08-01.json` | 30 primary | `6180519f4d72f5b082baae9cd14af7848786f7601359ed1c3625769ef4146bc7` |
| `reserve-cases-frozen-2026-08-01.json` | 10 ordered reserves | `df4c1ae9fcff16c30bd24b30f54ffc6ebacd03a5e4f5796b5334fe773f360803` |

All 40 cases have distinct original PR boundaries. Every case was certified
red three times on the buggy snapshot and green three times on the fixed twin,
with the relevant surrounding suite checked. The manifest contains the private
grader commit and command for audit, but the loader strips those fields from
review input.

The fixed twins are direct children of the buggy PR heads. Their ancestry does
not contain the private grader. A fixed tree may contain the minimal existing
test adaptations required by its production repair, but never the private
regression grader.

## Frozen prompts

| System/file | SHA-256 |
| --- | --- |
| `scored-prompts/full/correctness.md` | `95c67724efddc44716f0933709aa64a0f48ce4b96bf7c0692b696f29d3c2a712` |
| `scored-prompts/full/verifier.md` | `cfbabd76b53d0c41a955bd4330c4103bed357f905214718fc4e6819ff79454c5` |
| `scored-prompts/narrow/correctness.md` | `6868edf3a04758d2a46eaa040ff14e121e9fd767fa10ad8f044e0c8791a051b5` |
| `scored-prompts/narrow/verifier.md` | `cfbabd76b53d0c41a955bd4330c4103bed357f905214718fc4e6819ff79454c5` |

The verifier is byte-identical between systems. It is part of the shipped
reviewer pipeline, not the ground-truth gate. The named-defect match and final
statistics are deterministic. No LLM jury assigns labels or decides passage.

## Frozen runner and analysis

- Adapter commit: `8d86720c09361577373a353b0f2e4810c4423c8a`.
- Adapter reference in both manifests:
  `codex/cwgyh0-dev-benchmark-adapter@8d86720c0`.
- Scored runner `scored-live-run.ts`:
  `07d18100a024cac087967f3dba6654453a83c5d979bfb1849283ce14ba5f5bab`.
- Retry/randomization policy `scored-run-policy.ts`:
  `6c4b97fafd3bfaea92c2b76b0f1125554829a757de71b4a2c78a67dd574e543e`.
- Policy tests `scored-run-policy.test.ts`:
  `d8cb60ba9626c6a34f2721cba4e1f5d67d6be780c73992bd45a2206ef3a8f760`.
- Statistical primitives `scored-analysis.ts`:
  `f6ed381bc91fcf6e5781212912542ad47953c8e865abb2b0597bcde50f8c8abd`.
- Statistical tests `scored-analysis.test.ts`:
  `3da89900b43d63ad3a738a4abc9b42996605d23124466580b742f2ff526bb8b8`.
- Result scorer `score-results.ts`:
  `deed5b8e79874f6eee944537d1642e4d9a56e8756e4dc09a98e71b04f4435ae2`.
- Power analysis `power-analysis.ts`:
  `5577c357665f2f42616c46684c36280634af0f05456965403f7d062f39215ded`.
- Protocol `paired-benchmark-v2.md`:
  `4fa66c873fcc0fd573034f1602437aa114ad256165c553cb06568d2947a86f3e`.

The 21 policy/statistics tests pass. There are 1,000 paired bootstrap
resamples, using seed `5453573`. Trials are averaged within each case before
the case is sampled, so repeated trials do not become independent evidence.

## Execution policy

- Primary cases: 30.
- Frozen ordered reserves: 10.
- Trials: three per system, case, and variant.
- Successful planned calls: `30 × 2 × 2 × 3 = 360`.
- Randomization seed: `5453573`; primary case order and each case's 12 calls
  are deterministic shuffles.
- Correctness output ceiling: 8,000 tokens per model turn.
- Verifier output ceiling: 2,000 tokens per verification.
- Provider context ceiling: Sonnet 5's 1M-token context per request.
- Read-only tool-call ceiling: 40 per expert.
- Wall-clock ceiling: 360,000 ms per expert.
- Verification ceiling: 25 findings per review.
- Aggregate estimated cost stop: $1,000, using the frozen Sonnet 5 prices of
  $3/input MTok and $15/output MTok.
- Repository tools are read-only and have no network tool. The runner process
  may contact only the Anthropic API. Every trial clone has no Git remote.

One retry is allowed only for HTTP 408, HTTP 429, HTTP 5xx, or the predeclared
DNS/socket transport codes in `scored-run-policy.ts`. Schema violations, parser
failures, normal 4xx responses, wall-clock exhaustion, content failures, and
budget failures receive no retry. A second infrastructure failure quarantines
all partial output for that case, excludes it for both systems and both
variants, and inserts the next reserve in manifest order. Any non-infrastructure
failure makes the benchmark incomplete.

## Isolation preflight

`scored-preflight-2026-08-01.json` has SHA-256
`5484a289f3415b6cca57539daee4f3006ea069075bfa77225fba1410ee1f015d`.
It passed on 40 cases and 80 buggy/fixed repositories. For every snapshot the
runner fetched only the selected source commit, removed remotes and reflogs,
pruned unreachable objects, and proved forbidden grader/future objects absent.

The same validation and repository preparation run again as part of the scored
invocation; the standalone preflight is not trusted as a bypass.

## Exact invocation

Run from the safeword worktree. The output directory is durable ticket data;
scratch clones live in a fresh temporary holder.

```sh
run_holder=$(mktemp -d /private/tmp/cwgyh0-scored-run-XXXXXX)
op run --env-file=/Users/alex/.env.op.zshrc-migration -- \
  env CWGYH0_SCRATCH_ROOT="$run_holder/scratch" \
  CWGYH0_OUTPUT_ROOT="$PWD/.project/tickets/CWGYH0-pr-review-eval/scored-run-2026-08-01-raw" \
  bun .project/tickets/CWGYH0-pr-review-eval/scored-live-run.ts
```

## Recovery refreeze — 2026-08-07

No scored-corpus model call had occurred. After restoring the exact pinned
adapter commit, Bun 1.3.14 no longer resolved its extensionless absolute
TypeScript import. The runner now names the `.ts` file explicitly and derives
the ticket root from `import.meta.dir` instead of the original disposable
worktree path. Corpus, prompts, graders, thresholds, and adapter commit are
byte-identical to the original freeze.

- Recovered runner SHA-256:
  `a88c12eef8ad2ed1b5112144a8f0fa464130c63aa2afa868f8548a44150218b7`.

The runner refuses an existing scratch or output directory and refuses any
manifest, prompt, or adapter hash drift.

## Frozen scoring and gate

Report, separately:

1. buggy named-defect recall by system;
2. fixed-twin named-defect hit rate by system;
3. full-minus-narrow paired recall difference and 95% interval;
4. proved, directly falsified, unverifiable, and pending additional findings;
5. silence by system and variant;
6. exclusions, retries, reliability, tokens, latency, and estimated cost.

Every additional finding is self-verified against its pinned tree and entered
in a factual verification ledger as `proved`, `falsified`, or `unverifiable`.
The scorer refuses to declare validation while any finding is pending.

System A validates over B only when all are true:

- all 30 cases completed or were replaced under the frozen rule;
- the lower 95% paired-bootstrap bound for full-minus-narrow buggy recall is
  strictly greater than zero;
- the full system has zero named-defect hits on fixed twins;
- the full system has zero directly falsified findings of any kind;
- every finding has been mechanically matched or independently verified; and
- no contamination or harness-parity check failed.

Otherwise the result is incomplete, inconclusive, or does not validate the
full reviewer. It never establishes equivalence. Nate's prior triage and the
PR 2118 exchange are external sanity anchors only; they are not a fabricated
human A-vs-B ranking.
