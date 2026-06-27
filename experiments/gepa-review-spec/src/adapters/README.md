# Adapters

The eval keeps three decoupled seams — `dataset`, `task`, `evaluator` — so each
target platform is a thin adapter, not a rewrite. Import them from the barrel:

```ts
import { loadFixtures, createAnthropicRunner, scoreFixture, runEval } from '../index';
```

## GEPA (Python optimizer)

GEPA's inner loop must call the metric many times, fast — so keep the metric
**local**, never behind a SaaS API. A `GEPAAdapter.evaluate(batch, candidate)`
runs each fixture through the `task` runner and returns `evaluator` scores plus
the per-defect breakdown as the reflective trace (Actionable Side Information).

Since GEPA is Python and this harness is TS, the adapter shells out to a small
TS entry (reusing `runEval`) or re-implements the model call via LiteLLM while
importing the fixtures/labels from `fixtures/`. The metric definition stays the
single source of truth.

## LangSmith (TypeScript)

Mature TS SDK — lowest-friction fit for this codebase.

- **dataset** → upload `loadFixtures()` rows as a LangSmith Dataset
  (`inputs: { featureSource }`, `outputs: { expected }`).
- **task** → wrap `createAnthropicRunner().run` as the target function.
- **evaluator** → wrap `scoreFixture` as a custom (code) evaluator; no judge.

## Arize Phoenix

Code-based evaluators and datasets/experiments are supported; the mature path is
**Python** (the TS eval package is alpha). Reuse the same three seams: register
the corpus as a Phoenix Dataset, the runner as the task, and `scoreFixture` as a
code evaluator. Phoenix adds OTEL trace inspection — useful for seeing _why_ a
candidate missed a defect.

## What stays constant

Across all three, the **metric** (`evaluator.ts`) and the **corpus**
(`fixtures/`) do not change. Only the orchestration loop differs. That is the
whole point of the seam split.
