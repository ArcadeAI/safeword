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
  CWGYH0_COST_TARGET_USD=10 \
  bun .project/tickets/CWGYH0-pr-review-eval/scored-live-run.ts
```

For later checkpoints, use a fresh `run_holder`, reuse the same output root,
and raise `CWGYH0_COST_TARGET_USD` cumulatively to `20`, `50`, `100`, `200`,
and onward. The runner stops after the first complete randomized work item
whose recorded cumulative cost reaches the target. It never exposes or scores
interim model answers.

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

## Staged-spend recovery refreeze — 2026-08-08

No scored-corpus model call had occurred. A development-only Sonnet 5
calibration used the already-burned DEV-R01 case and the frozen full/narrow
prompts. Its four buggy/fixed calls cost $3.533523 total, projecting one complete
three-trial scored case block at about $10.60.

The runner now supports cumulative complete-case checkpoints: 1, 2, 5, 10,
20, and 30 cases (approximately $10, $20, $50, $100, $200, and completion).
It atomically persists the frozen queue, reserve position, exclusions,
completed cases, and cumulative cost. A later stage must match the exact frozen
run and refuses an interrupted case directory. Checkpoints occur only between
complete 12-call case blocks; they do not inspect, score, or tune model output.
Safe repositories are prepared lazily for the active case, while
`CWGYH0_PREFLIGHT_ONLY=1` retains the exhaustive 80-snapshot isolation pass.

- Staged runner SHA-256:
  `e7642dbf9aaf94c60bf07824aa3d4075e68f456b1488682e5d0551e632dd3a0a`.
- Retry/randomization/checkpoint policy SHA-256:
  `86a8385c3709ef9f9240b6173561add26c21695ab67aec4dbbc518f0a08a1cbe`.
- Policy tests SHA-256:
  `4bfa20ffdb6da99e53c104bccb54e25b8280601261cff7d0c1fb1176519d5b78`.
- Statistical tests SHA-256:
  `98e467bddcb8c662b93516e28c918b800a72b39ba8351cf0ff5c5b53673375b4`.
- Thirty-two policy/statistics tests pass under the repository's Vitest
  runner; ESLint, Prettier, and a Bun production bundle pass.

Corpus, prompts, graders, thresholds, model, prices, trials, randomization,
retry/substitution rules, statistical primitives, and scorer are unchanged.

## Work-item spend recovery refreeze — 2026-08-08

The first scored checkpoint selected SCORE-S33 under the frozen shuffle. Its
first four randomized work items completed for $8.638881 with zero retries and
zero infrastructure errors. Only usage, duration, retry, and error metadata
were inspected. Findings, named-defect matches, and reviewer text were not
opened or scored. The process was stopped after the fourth durable record and
before the fifth API request.

This operational evidence falsified the complete-case cost assumption: one
12-call case can materially exceed $10. Without changing any scientific input
or output, the runner now persists state atomically after every successful work
item and resumes the same current case at its next frozen work index. Dollar
targets are cumulative and may overshoot only by the final indivisible work
item. Resume validation refuses frozen-run drift, missing state, or an output
directory inconsistent with the recorded attempted-case count.

The four durable SCORE-S33 records were recovered into version-2 state with
`nextWorkIndex: 4`, cumulative cost `$8.638881`, and the untouched remainder of
the frozen shuffled queue. A no-model resume check loaded this state and wrote
a checkpoint summary without preparing a repository or making an API call.

- Work-item checkpoint runner SHA-256:
  `76b75a5421f6e78cfd280a13e5a9e249f005929f638115a752753f611355bdb8`.
- Retry/randomization/checkpoint policy SHA-256:
  `91eb87b80e0437fae8972ea38627c937e08cce0d484f89179fb00639012cb6cc`.
- Policy tests SHA-256:
  `ade4882747a8d3bf530537196568f7c981792450a7232b35966cece4353a9ec5`.
- Statistical tests SHA-256 remains:
  `98e467bddcb8c662b93516e28c918b800a72b39ba8351cf0ff5c5b53673375b4`.
- Forty-two policy/statistics tests pass; ESLint, Prettier, the Bun production
  bundle, and the no-model resume check pass.

Corpus, prompts, model, graders, thresholds, trials, work order, completed
outputs, retry/substitution rules, statistical primitives, and scorer remain
unchanged. The recovery decision used cost and operational metadata only.

## Staged execution record — 2026-08-08

| Gate | Durable calls | Completed cases | Actual cumulative cost | Operational result |
| ---: | ---: | ---: | ---: | --- |
| $10 | 6 | 0 | $10.277085 | passed |
| $20 | 12 | 1 | $20.407170 | passed |
| $50 | 28 | 2 | $50.350935 | passed |
| $100 | 51 | 4 | $106.576443 | passed |
| $200 | 100 | 8 | $200.585727 | passed |
| $500 / full run | 360 | 30 | $440.076699 | completed |

The outer runner durably wrote 360 records without a provider retry, case
exclusion, duplicate record, or resume mismatch. That operational statement was
later found to be misleading: the inner review runner had converted expert
failures into successful empty reports, so the outer retry policy could not see
or classify them. The validity audit below supersedes any claim that 360 usable
review calls completed. Findings, named-defect matches, reviewer text, and
interim scores remained blinded until the outer run completed.

Before the $200 stage, the branch merged `origin/main` at `78afa7a7b`
(`v0.74.6`). All frozen corpus, prompt, runner, policy, and scorer hashes were
unchanged. The merge removed dependencies from the disposable pinned adapter
worktree; restoring its exact commit `8d86720c09361577373a353b0f2e4810c4423c8a`
and frozen-lockfile dependencies recovered the environment without changing a
scientific input. Forty-two policy/statistics tests, Prettier, ESLint, and the
Bun production bundle pass after the merge.

The first $200 authorization attempts timed out before launch. The 1Password
desktop app was unlocked, Touch ID and CLI integration were enabled, and
resetting only the CLI integration handshake recovered authorization. The
runner then resumed at the exact saved work index and reached the checkpoint
without a duplicate paid call.

Before the final stage, adapter commit
`8d86720c09361577373a353b0f2e4810c4423c8a` was made durable on remote branch
`ArcadeAI/monorepo:codex/cwgyh0-dev-benchmark-adapter`. The remote branch head
is `260f136abc3d2a43d2fc6b4618997a3894211343`; Git verifies the frozen adapter
commit is its ancestor.

## Post-run scoring audit — 2026-08-10

### Final scientific disposition: void — instrument failure

The run is void for confirmatory use. The durable validity audit is
`scored-run-validity-audit-2026-08-10.json`.

Only 122 of 360 records contain a routed expert with a usable report. The other
238 comprise 196 provider connection failures, 18 schema-invalid reports, 12
records with no expert routed, and 12 socket, timeout, or wall-clock failures.
The runner returned these conditions inside a nominally successful report, and
the scorer admitted the resulting empty finding arrays as recall misses and
silence. Only S21 and S24 have all twelve usable prompt/variant/trial records.

The 122 usable records cost $342.434583 and the non-usable records cost
$97.642116. Those subsets may support labeled descriptive cost/latency summaries
and failure fixtures only. They must not support recall, silence, arm-effect, or
confirmatory validation estimates because admission is conditioned on successful
completion and is plausibly correlated with case complexity.

The raw directory manifest hash is
`d5f691735b3bc5a36e749e49722bf203e38f2c4f90ba849dfefa003efcc71971`.
Verify this hash before any reuse and retain the manifest independently from the
working copy before paid recovery work begins.

The construct audit also directly falsified repeated findings, including the
claim that Go 1.26.1 rejects `new(value)` and the claim that S33's certified
fixed `--template` flag is unsupported. Finding-verification remains useful as
exploratory diagnosis; it cannot rescue this run.

Because the scored outputs exposed the exact-substring matcher's defect, these
30 cases are contaminated for scorer redesign. Reusing them after changing the
scorer is exploratory or amended evidence. A confirmatory v3 requires a fresh,
powered holdout and a new freeze.

### Preserved frozen scorer output

The frozen deterministic scorer produced status
`provisional-awaiting-finding-verification`. Its literal registered-alias match
reported zero named-defect hits for either system. There are 82 additional
findings awaiting independent factual verification: 64 from full and 18 from
narrow. The full system emitted 27 findings on buggy records and 37 on fixed
records; narrow emitted 11 and 7 respectively.

The preserved provisional result is
`scored-results-provisional-2026-08-10.json`, SHA-256
`4699650ef70da68ae19f029f9fc12fab3f5a7494f4eea59f1da97e42f3340e2e`.

A required construct-validity audit found the exact-substring named-defect
matcher has false negatives. At least the full system's buggy S01 trial 2
finding names the registered causal file and semantically describes the frozen
cursor-reset mechanism and repeated-first-page consequence, but none of the
registered multiword aliases appears byte-for-byte in its paraphrase, so the
frozen matcher rejects it. This is a scoring-contract defect, not input drift:
the frozen scorer and adapter hashes match their preregistered values.

The preregistered primary result must not be rewritten post hoc. As a labeled
sensitivity check only, crediting that obvious S01 hit changes full recall from
0 to 1/90 (`0.011111`), with paired full-minus-narrow interval `[0, 0.033333]`.
The lower bound remains zero, so the full reviewer cannot validate over narrow
under either the literal frozen score or this minimal semantic correction.
The text above preserves what the frozen scorer emitted; it is not the final
scientific status. The run is void regardless of whether the 82 additional
findings are later classified.

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
