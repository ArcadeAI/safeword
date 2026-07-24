# Baseline grid — review-spec prompt across models (2026-07-22)

What: baseline grades of the **shipped** `review-spec` SKILL.md (the candidate the eval
feeds) across models, to see how the prompt behaves on each engine production might use.
Corpus: **20 fixtures** (12 train, 8 test). Recall is matched at defect-**family** level.

> ⚠️ Read the repeat ranges (§2), not the single-run grid (§1), as the real result.
> On 20 fixtures a single defect = an 8–17% recall swing, so point estimates are noisy.

Reproduce (key injected by 1Password): from `experiments/gepa-review-spec/`,

```
op run --env-file=/Users/alex/.env.op.zshrc-migration -- bash -c \
  'SAFEWORD_EVAL_MODEL=claude-opus-4-8 bun src/baseline.ts'                       # Anthropic
op run --env-file=/Users/alex/.env.op.zshrc-migration -- bash -c \
  'SAFEWORD_EVAL_VENDOR=openai SAFEWORD_EVAL_OPENAI_MODEL=gpt-5.6-terra bun src/baseline.ts'  # OpenAI
```

Env: `SAFEWORD_EVAL_MODEL` (Anthropic), `SAFEWORD_EVAL_VENDOR=openai` +
`SAFEWORD_EVAL_OPENAI_MODEL` (OpenAI), `SAFEWORD_EVAL_EFFORT=off|low|..|max`
(default off = thinking/reasoning disabled, which isolates the prompt).

## 1. First-look grid — N=1, thinking off (DO NOT over-read)

| Model         | Train recall  | Test recall | Train FA/fx | Test FA/fx |
| ------------- | ------------- | ----------- | ----------- | ---------- |
| Opus 4.8      | 100% (13/13)  | 100% (6/6)  | 1.40        | 1.00       |
| Sonnet 5      | 92.3% (12/13) | 100% (6/6)  | 1.20        | 2.38       |
| gpt-5.6-sol   | 92.3% (12/13) | 83.3% (5/6) | 1.10        | 1.25       |
| gpt-5.6-terra | 92.3% (12/13) | 100% (6/6)  | 0.50        | 1.38       |

## 2. Repeat reliability — 3 runs each, thinking off (ranges)

| Model         | Train recall       | Test recall  | Train FA/fx | Test FA/fx |
| ------------- | ------------------ | ------------ | ----------- | ---------- |
| Sonnet 5      | 85–100% (11–13/13) | 83–100%      | 1.1–1.3     | 1.9–2.1    |
| Opus 4.8      | 92–100%            | 83–100%      | 1.3–1.6     | 1.1–1.6    |
| gpt-5.6-sol   | 92% (stable)       | 83% (stable) | 0.9–1.1     | 0.8–1.9    |
| gpt-5.6-terra | 92% (stable)       | 83–100%      | 0.4–0.8     | 1.1–1.4    |

### Signal vs noise

- **Noise** (did NOT survive repeats): "Opus is best / 100-100" (dropped to 83% test once);
  "terra catches `formatter-determinism-order`, sol doesn't" (terra catches it ~half the
  time); "only Opus catches `resolver-determinism-order`" (Sonnet & Opus each caught it in
  one run, missed in others). Model recall differences are within-noise on this corpus.
- **Signal** (survived): **gpt-5.6-sol reliably misses `formatter-determinism-order`** (83%
  test every run — a stable blind spot). **Precision ordering is stable**: terra reliably
  cleanest (0.4–0.8 FA/fx), Sonnet 5 reliably noisiest on test (1.9–2.1).

## 3. Methodology — why "just average more runs" is the wrong fix

Per [Adding Error Bars to Evals, Miller 2024 (arXiv 2411.00640)](https://arxiv.org/abs/2411.00640)
and [Don't Use the CLT in LLM Evals With <~few-hundred datapoints (arXiv 2503.01747)](https://arxiv.org/pdf/2503.01747):

- **The number of fixtures `n` is the primary variance lever**, not repeated sampling —
  per-question stochastic variance washes out as `n` grows. Repeats (m≥3) are for
  _estimating_ variance, which §2 already did; they are not the main reduction.
- **20 fixtures (n=6 test) is below the threshold where CLT/averaging error bars are valid.**
  Averaging over 6 clustered test items does not tighten the aggregate.
- Fixtures are **clustered** (`resolver-*` / `formatter-*` share base specs; family-level
  matching) → clustered standard errors, not naive CLT.
- Compare models **paired per-fixture**, not on aggregate recall deltas (as §1 did).

**Implication for CWGYH0 scoring:** if the frozen prompt is scored on one/few passes over
these 20 fixtures, that score carries the same ±17% variance. Reliable scoring needs **more
fixtures first**, then bootstrap/clustered/paired CIs — and a power analysis to check whether
20 fixtures can detect a real model/prompt difference at all (§2 suggests not).

## 4. Thinking sweep — 5 models × {low, high} effort (N=1 per cell)

> ⚠️ **Confound (my slip):** the config-loader fixtures (§corpus) landed _mid-sweep_, so 8
> of 10 runs used the 20-fixture corpus but the last two (sol/terra at **high**) ran on 23.
> Their test column is not comparable and is marked `*`. The headline rests on the 8
> consistent runs. Read everything against the §2 noise bands, not as point values.

| Model         | low train/test R | high train/test R | low FA/fx tr·te | high FA/fx tr·te |
| ------------- | ---------------- | ----------------- | --------------- | ---------------- |
| Opus 4.8      | 92 / 100         | 92 / 100          | 1.10 · 1.13     | 1.20 · 1.25      |
| Sonnet 5      | 92 / 100         | 92 / 100          | 0.60 · 1.38     | 1.10 · 1.75      |
| Fable 5       | 100 / 100        | 100 / 100         | 1.20 · 1.13     | 1.20 · 1.50      |
| gpt-5.6-sol   | 92 / 83          | 92 / 87*          | 1.60 · 1.75     | 1.70 · 1.36*     |
| gpt-5.6-terra | 92 / 83          | 92 / 87*          | 1.20 · 1.88     | 1.40 · —*        |

### Findings

- **Thinking level does essentially nothing.** For the clean low-vs-high comparison
  (Opus/Sonnet/Fable, all on 20 fixtures), recall is identical and FA moves only within
  the §2 noise band. More reasoning does **not** close the determinism-order gaps or the
  vacuous-non-claim over-flagging. The blind spots are prompt/model properties, invariant
  to effort — you can't crank effort to fix them.
- **Fable 5 uniquely catches `resolver-determinism-order`** (100% train at BOTH low and
  high; every other model misses it, or catches it flakily per §2). A **model** edge, not
  an effort edge. Cost: Fable has the heaviest vacuous-non-claim over-flagging (11–12 FA).
- **`vacuous-non-claim` over-flag is universal and effort-invariant** — every model, both
  levels (train FA 2–17). Robustly a **prompt** problem — the clearest post-scoring fix target.
- **sol's `formatter-determinism-order` miss persists at high effort** — reasoning doesn't rescue it.
- **New fixtures validated behaviorally:** sol@high caught `config-loader-vacuous-non-claim`
  (tp 1, FA 0) on the clean base — the seeded label is sound, not just structurally valid.

_(Fable's edge is 2/2 samples; needs repeats to separate a real capability from luck.)_
