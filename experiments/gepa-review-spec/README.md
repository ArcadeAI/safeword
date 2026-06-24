# GEPA × `review-spec` — eval harness (research spike)

A behavioral eval for the `review-spec` skill, built so it can later drive a
[GEPA](https://github.com/gepa-ai/gepa) prompt-optimization loop — and so it can
later be lifted onto LangSmith or Arize Phoenix without a rewrite.

**Status:** Phases 1–5 run. 20 fixtures (12 train / 8 held-out) mutated from
safeword's own `test-plan-resolver` and `formatter-aware-lint-hook` features. One
GEPA run completed; its winner was **rejected** at review (it gamed the eval —
see the ticket work log). Metric is decoupled recall vs false-alarms
with **family-level** recall matching (see `evaluator.ts`). Baseline (Sonnet 4.6,
temp 0): **family-recall 100%** on both splits; false alarms **1.50/clean-fixture**
(train), **2.13/clean-fixture** (held-out) — so precision (over-flagging clean
concrete-value Thens) is the sole GEPA target, behind a hard 100% recall floor.
Phase 4 (the Python GEPA adapter) is next.

**Isolation:** everything lives here, under `experiments/`. No runtime
dependency is added to `packages/cli`; the shipped `review-spec/SKILL.md` is
untouched. Delete this directory and nothing else changes.

## Why this exists

GEPA optimizes text against a metric. Safeword has ~11,500 lines of prompts but
no metric that scores prompt _behavior_. `review-spec` is the one skill whose
output is objectively scoreable: seed a `.feature` file with known defects, then
measure how many the skill catches. Ground truth is known because we injected
it, so scoring is **deterministic set-matching — no LLM judge**, which dodges the
judge-reliability problems that plague fuzzy evals.

## The three seams

The eval is split to match how LangSmith and Phoenix both model an eval
(dataset + target/task + evaluator), so a platform adapter is a thin wrapper.

| Seam          | File               | Role                                                                         |
| ------------- | ------------------ | ---------------------------------------------------------------------------- |
| **dataset**   | `src/dataset.ts`   | load `{ input: .feature, reference: labels }` fixtures + train/test split    |
| **task**      | `src/task.ts`      | run a candidate prompt over a feature file → `Detection[]`                   |
| **evaluator** | `src/evaluator.ts` | pure metric: family-level recall + false-alarm rate (no F1) + per-defect ASI |
| harness       | `src/harness.ts`   | composes the three; platform-agnostic                                        |

See `src/adapters/README.md` for how to drop in a LangSmith, Phoenix, or GEPA
adapter against these seams.

## Corpus

`fixtures/<name>.feature` + `fixtures/<name>.expected.json`. Each defect is
labeled with a `defectType` (mapped to a `review-spec` check), a `severity`, and
a `scope` (`scenario` = pinned to one scenario; `fixture` = set-level, matched
if reported anywhere in the file).

20 fixtures, mostly built by the **certified-clean-base → single-mutation** pattern:
excerpt a clean 3-scenario base from a real safeword `.feature`, then apply ONE
semantic mutation operator (the operator IS the label). A fixture is
`certifiedClean` when its base was adjudicated free of must-fix defects — only
then does an unmatched must-fix detection count as a false alarm (on an ordinary
positive it's `unlabeled`, never penalized, because the corpus isn't exhaustive).
Recall is matched at the **defect-family** level so a defensible subtype swap
(e.g. `vacuous-given-echo` for a `vacuous-trivially-true` seed) is a catch, not a
double-penalty. The held-out (`test`) split uses a DISTINCT base
(`formatter-aware-lint-hook`) GEPA never trains on.

`rescore.ts <trace>` re-scores a saved `SAFEWORD_EVAL_TRACE=1` run with the
current metric, token-free — handy for comparing GEPA candidates against a cached
baseline without re-calling the API.

## Running

Unit tests (no API key, deterministic):

```bash
npx vitest run --config experiments/gepa-review-spec/vitest.config.ts
```

Phase 3 baseline (spends tokens — scores the real skill):

```bash
ANTHROPIC_API_KEY=sk-... bun experiments/gepa-review-spec/src/baseline.ts
```

## Next steps

1. Run the baseline on the 3 seed fixtures; confirm auto-score matches a human
   read. If parsing is noisy, tighten `EVAL_OUTPUT_CONTRACT` in `src/task.ts`
   (the eval wrapper — never the shipped skill).
2. Expand the corpus to ~20 fixtures, ideally via **mutation** of safeword's own
   shipping `.feature` files (the mutation operator is the ground-truth label).
3. Phase 4: a Python GEPA adapter that calls this harness as its metric.
