# Paired retrospective benchmark v2

**Status:** methodology selected; corpus and decision thresholds must be frozen
before scored runs begin.

## Decision

Replace the first retrospective pilot with a fresh, paired benchmark:

- each case is one real, post-cutoff defect in an actual PR snapshot;
- the case contains a **buggy PR** and a minimally changed **fixed twin**;
- a deterministic reproduction fails on the buggy version and passes on the
  fixed twin;
- both frozen prompts run through the shipped PR-review harness, repeatedly,
  under identical limits;
- results are compared at the independent-case level.

The first pilot remains an audit artifact. Its 1–1 result is inconclusive, not
evidence that the two prompts are equally capable. Its cases are burned and may
not appear in the scored v2 corpus.

## Why this design

The alternatives fail for structural reasons:

1. **Repair the first pilot.** More runs cannot create the missing human
   head-to-head comparison, restore holdout status, or turn six clustered diffs
   into 24 independent cases.
2. **Run a live shadow reviewer.** This is production-realistic, but action and
   silence remain socially mediated. A clean merge still cannot falsify a
   finding, and reviewer comments intervene in the outcome.
3. **Paired buggy/fixed benchmark — selected.** The later fix discovers
   candidates; executable behavior establishes truth. The fixed twin supplies a
   narrow, certified negative for the *specific defect* without pretending that
   the entire PR is clean.

This follows the useful pattern in real-defect benchmarks: retain buggy and
fixed revisions and require a triggering test to fail before the fix and pass
after it. It also follows current agent-eval guidance to use repeated trials,
production-like harnesses, isolated environments, complete traces, paired
comparisons, and case-clustered uncertainty.

## Question

Under the shipped PR-review runner, does the full reviewer detect verified
defects more reliably than the narrow bug-only reviewer without producing a
directly falsified finding?

This benchmark compares two complete reviewer systems: prompt, model, runner,
tools, and limits. It does not claim to isolate the prompt from the harness.

## Non-negotiable label semantics

- **Strong positive:** the pre-fix snapshot exhibits the pre-registered failure,
  and the reproduction proves it.
- **Narrow certified negative:** the fixed twin does not exhibit that same
  failure, and the same reproduction proves it.
- **Not a negative:** merged clean, approved, no comments, no later fix, or no
  observed human action.
- **False positive:** a review claim is directly disproved on the pinned tree or
  by an executable check.
- **Unverifiable:** a claim cannot be proved or disproved within the frozen
  evidence. Report it separately; do not silently score it false.

The fixed twin certifies only the named defect. It does not certify that the
whole PR contains no other defects.

## Phase 0 — development set

Build five development cases first. Use them only to validate:

- repository reconstruction;
- the shipped invocation path and output parser;
- reproduction determinism;
- trace capture;
- the mechanical hit grader; and
- equal resource enforcement.

Prompts may be repaired while using the development set. Development cases are
permanently excluded from the scored corpus.

## Phase 1 — fresh case discovery

### Eligibility

A scored case must satisfy every condition:

1. The changed code and later fix are after the frozen model cutoff.
2. The PR and defect were not used in the first pilot, prompt development, or
   the development set.
3. The defect was caused or exposed by the PR diff and was reviewable at the
   original head.
4. The failure has a concrete user, correctness, security, data-integrity, or
   evidence-integrity consequence within the reviewer's stated scope.
5. A deterministic reproduction can fail on the buggy snapshot and pass on the
   fixed twin.
6. The fixing change can be reduced to the defect without unrelated feature or
   refactor changes.
7. The case-specific output match can be graded mechanically before reviewer
   outputs are seen.

Documentation polish, naming, generic observability improvements, and
test-strength suggestions without a demonstrated false-confidence consequence
are excluded from the core score. They may be reported as an exploratory
appendix.

### Discovery sources

Claude session logs and SZZ-style history are candidate generators only. They
do not assign the final label. A candidate becomes a scored case only after the
buggy/fixed reproduction and PR-boundary checks pass.

### Independent unit

The independent unit is one PR defect case, not one finding sentence. Multiple
assertions about the same causal defect are nested checks within that case.
Only one primary case is selected from a PR unless the failures have separate
causes, separate reproductions, and separate fixes. Results still cluster by
PR.

## Phase 2 — construct and certify each pair

For every case, preserve:

- original PR base and pre-fix head;
- PR title, body, and intent available at review time;
- exact buggy diff;
- minimal fixed twin;
- reproduction command and expected outputs;
- causal hunk and allowed line range;
- failure mechanism and consequence;
- source and fix commit provenance; and
- hashes of every artifact.

The reproduction, later fix provenance, and expected outputs are grader
artifacts. They are never exposed to the reviewer. The buggy review input
contains exactly the information available at the original PR head. The fixed
twin contains the same PR plus only the minimal corrective code; it does not
include a newly added regression test unless that test was already present in
the original review input.

Certification runs in a fresh isolated checkout:

1. Run the reproduction at the buggy head at least three times. All three must
   fail for the pre-registered reason.
2. Apply the minimal fixed twin.
3. Run the same reproduction at least three times. All three must pass.
4. Run the relevant existing suite to reject twins that introduce unrelated
   failures.
5. Inspect the original PR boundary and later fix directly. SZZ metadata alone
   is insufficient.

If any step is flaky, ambiguous, or environment-dependent, exclude the case
before the scored manifest is frozen.

## Phase 3 — freeze before scoring

Commit an immutable manifest containing:

- all scored cases and a separately frozen reserve list;
- the full prompt texts and SHA-256 hashes;
- exact model identifiers, not moving aliases;
- runner commit and invocation command;
- tool policy and network policy;
- input, output, time, tool-call, and cost ceilings;
- trial count and randomization seed;
- graders, grader tests, and grader hashes;
- statistical analysis code;
- exclusion and retry rules; and
- decision thresholds.

Corpus builders must not inspect reviewer outputs before this commit. Once
scored outputs exist, neither prompts, cases, graders, nor thresholds may
change. Any change creates a new benchmark version with a fresh holdout.

## Phase 4 — production-matched execution

Run prompt A and prompt B through the shipped PR-review entry point, not a hand
constructed agent session.

For each case and prompt:

- start from a clean, isolated clone containing only history available at the
  original PR head;
- remove descendant refs, reflogs, remotes, and unreachable objects;
- use the same pinned model, effort, tools, permissions, and resource ceilings;
- randomize prompt and case order using the frozen seed;
- run at least three independent trials;
- retain the complete input, output, tool-call trace, parser result, timing,
  token usage, and exit status; and
- run both buggy and fixed members of the pair.

The exact number of independent cases and trials must come from a pre-run power
analysis. Until that analysis is committed, **20 independent PR cases × 3
trials per prompt per variant is a feasibility floor, not a ship-quality sample
size**.

### Infrastructure failures

One automatic retry is allowed only for a pre-declared infrastructure error,
using the identical frozen configuration. If it fails again, exclude that case
for both prompts and both variants, report the exclusion, and substitute the
next frozen reserve case. No prompt receives an ad hoc larger budget.

## Mechanical grading

Each case defines a machine-readable `failure_id` with:

- causal file and hunk range;
- review dimension;
- required failure mechanism;
- required consequence;
- permitted pre-registered aliases; and
- explicit near-miss examples.

A finding is a hit only if it:

1. anchors to the causal file and hunk;
2. names the required failure mechanism; and
3. names the required consequence.

The deterministic grader and aliases are written before outputs are seen. Each
grader must have a reference-positive fixture and at least two adversarial
near-miss fixtures. If a case cannot support reliable mechanical grading, it
does not enter the core benchmark.

No LLM jury is a scoring gate. An LLM may retrieve candidate text for the
deterministic grader, but ambiguous matches remain unscored and are reported.

Unrelated findings are verified independently against the pinned tree:

- reproduced/proved;
- directly falsified; or
- unverifiable.

Merged status and lack of human response contribute no scoring evidence.

## Metrics

Report separate axes; never collapse them into F1 or one headline score.

1. **Verified-defect recall:** per-case trial hit rate on buggy snapshots.
2. **Paired suppression:** whether the named defect disappears on the fixed
   twin.
3. **Directly falsified findings:** count and case rate on both variants.
4. **Verified additional findings:** proved findings outside the named defect.
5. **Unverifiable findings:** count and case rate.
6. **Silence:** case rate with no findings, reported separately for buggy and
   fixed variants.
7. **Reliability and cost:** per-case variance, latency, tokens, tool calls, and
   dollars.

Compute A-minus-B paired differences. Average trials within a case, then use a
paired bootstrap over independent cases, clustered by PR, with the frozen seed.
Report effect sizes and 95% confidence intervals. Labels from one PR never count
as independent observations.

## Decision rule

The benchmark validates prompt A over prompt B only if all conditions hold:

1. Every frozen case/trial is completed or replaced under the frozen
   infrastructure rule.
2. The lower bound of the 95% clustered paired-bootstrap interval for
   A-minus-B verified-defect recall is greater than zero.
3. Prompt A produces zero directly falsified findings.
4. Prompt A produces zero named-defect hits on the fixed twins. Because the
   reproduction certifies that the named failure is absent, any such hit is a
   directly falsified finding and also fails condition 3.
5. No contamination or harness-parity audit fails.

Otherwise the result is **inconclusive** or **does not validate A**. It never
proves two prompts equivalent. G5337S remains blocked unless A clears every
condition.

There is no score-based early stopping. If cost, safety, or infrastructure
forces an early stop, the result is incomplete and cannot unblock anything.

## Role of existing human evidence

Nate's 10-PR triage and the PR 2118 exchange remain external sanity checks:
useful findings should resemble the dimensions humans previously endorsed, and
the rejected PR 2145 prose-only escalation remains a known failure mode.

They are **not** a historical A-vs-B ranking because prompt B was never judged
head-to-head. No claim of human-order agreement may be made without such data,
and this design requests no new engineer time.

## Durable artifacts

Store in git:

- protocol and frozen manifest;
- compact case metadata and artifact hashes;
- reproduction and grader code/tests;
- prompt and runner hashes;
- aggregate and case-level scores; and
- all exclusions and deviations.

Store large raw traces in an immutable artifact archive and commit its content
hash and retrieval instructions. A scratch directory is not an acceptable
system of record.

## Premortem

Assume this benchmark still gives the wrong answer:

- **The reproduction proves a later bug, not a reviewable PR defect.** Earliest
  warning: the causal hunk is outside the PR or the failure requires future
  context. Mitigation: enforce the PR-boundary check before admission.
- **The grader rewards keyword mimicry.** Earliest warning: near-miss fixtures
  pass or the fixed twin receives the same finding. Mitigation: require causal
  hunk, mechanism, and consequence; exclude cases that cannot be graded
  mechanically.
- **The benchmark measures a lab scaffold, not the product.** Earliest warning:
  hand invocation, parser bypass, or resource-policy drift. Mitigation: invoke
  the pinned shipped runner and archive the parsed and raw outputs.
- **A few PR families dominate the result.** Earliest warning: many cases share
  one PR, subsystem, author, or fix pattern. Mitigation: one primary case per PR,
  stratify the manifest, and cluster statistics by PR.
- **The holdout leaks into prompt work.** Earliest warning: a prompt edit cites a
  scored case. Mitigation: separate development and scored sets; a leak burns
  the case and requires a frozen reserve replacement before any scoring.

## Evidence

- Anthropic, [Demystifying evals for AI
  agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents):
  repeated trials, isolated production-like harnesses, complete traces, and
  transcript inspection.
- Anthropic, [A statistical approach to model
  evaluations](https://www.anthropic.com/research/statistical-approach-to-model-evals):
  paired differences, resampling stochastic outputs, clustered uncertainty,
  and pre-run power analysis.
- Defects4J, [real-fault benchmark
  design](https://defects4j.org/): minimized buggy/fixed revisions and a
  non-flaky triggering test that fails before and passes after the fix.
- SWE-bench, [reproducible evaluation
  harness](https://github.com/SWE-bench/SWE-bench): real repository tasks in
  clean Docker environments with executable grading.
