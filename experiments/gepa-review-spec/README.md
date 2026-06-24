# GEPA × `review-spec` — eval harness (research spike)

A behavioral eval for the `review-spec` skill, built so it can later drive a
[GEPA](https://github.com/gepa-ai/gepa) prompt-optimization loop — and so it can
later be lifted onto LangSmith or Arize Phoenix without a rewrite.

**Status:** Phases 1–3 scaffolded (corpus seed + metric + baseline runner).
Phase 4 (GEPA) and the full corpus are not built yet.

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

| Seam          | File               | Role                                                                      |
| ------------- | ------------------ | ------------------------------------------------------------------------- |
| **dataset**   | `src/dataset.ts`   | load `{ input: .feature, reference: labels }` fixtures + train/test split |
| **task**      | `src/task.ts`      | run a candidate prompt over a feature file → `Detection[]`                |
| **evaluator** | `src/evaluator.ts` | pure metric: precision / recall / F1 + per-defect ASI breakdown           |
| harness       | `src/harness.ts`   | composes the three; platform-agnostic                                     |

See `src/adapters/README.md` for how to drop in a LangSmith, Phoenix, or GEPA
adapter against these seams.

## Corpus

`fixtures/<name>.feature` + `fixtures/<name>.expected.json`. Each defect is
labeled with a `defectType` (mapped to a `review-spec` check), a `severity`, and
a `scope` (`scenario` = pinned to one scenario; `fixture` = set-level, matched
if reported anywhere in the file). Clean fixtures (no defects) measure false
positives.

Three seed fixtures exist as the **cheapest test** of the riskiest assumption —
that the skill's free-form findings can be parsed and scored reliably. Validate
that on these three before expanding to the full ~20.

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
