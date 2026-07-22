---
id: 21RAT9
slug: review-spec-eval-hardening
type: feature
phase: intake
status: in_progress
scope: Expand + de-noise the review-spec fixture corpus into GEPA feedback/pareto/test splits; re-run GEPA on the bare-model proxy with the corpus-structure leak stripped + a verbosity guard; add a Tier-2 headless-harness validation runner as the ship gate.
out_of_scope: The G5337S PR-reviewer real-PR/harness eval (CWGYH0's track); optimizing any other skill/prompt; wiring GEPA into CI.
done_when: Corpus expanded + split with repeat-variance re-measured; a GEPA re-run honestly adjudicated (ship or hold); a harness-validation runner exists and hard-gates the final candidate before any review-spec change ships.
depends_on: [E2D8S5]
created: 2026-07-22T13:24:46.554Z
last_modified: 2026-07-22T13:24:46.554Z
---

# Reliable two-tier review-spec eval (corpus + GEPA re-run + harness gate)

**Goal:** Make the review-spec behavioral eval reliable enough to adjudicate a prompt change: expand and de-noise the fixture corpus into GEPA feedback/pareto/test splits, re-run GEPA on the bare-model proxy with the corpus-structure leak stripped and a verbosity guard, and add a Tier-2 headless-harness validation runner (claude -p / codex exec) as a hard ship gate.

**Classification:** feature — SAFEWORD sizing: 3+ files, new persistent state, or multiple user flows; run BDD before implementation.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-22T13:24:46.554Z Started: Created ticket 21RAT9
- 2026-07-22 **Plan — two-tier eval architecture** (tonight's `/figure-it-out`, verified vs current GEPA/eval literature). E2D8S5 left a working eval but a corpus too small/noisy to adjudicate a change (±17% recall variance at 20–23 fixtures — `experiments/gepa-review-spec/results-baseline-grid.md`). Three phases, in order:
  1. **Corpus is the gate.** Expand + de-noise the corpus and restructure into GEPA feedback/pareto/test splits. Bias new fixtures to the two families tonight exposed: `determinism-order` (only Fable catches it; a 4/5 coin-flip → needs a clean signal) and clean-but-adjacent scenarios for the universal, effort-invariant `vacuous-non-claim` over-flag. Add new DOMAINS (E2D8S5's resolver-authored calibration didn't generalize to the formatter held-out). Re-measure repeat variance. Method (proven in E2D8S5): excerpt a clean base from a real safeword `.feature`, adjudicate clean, one mutation operator per fixture, distinct bases for held-out.
  2. **GEPA on the bare-model proxy** — only after (1). Sample-efficient and consumes the feedback `gepa-eval.ts` already emits, but overfits a thin corpus (E2D8S5's winner gamed the eval + ballooned +91%). Strip the corpus-structure leak from feedback + add a verbosity guard to the objective.
  3. **Tier-2 harness-validation runner** — run only the final candidate through the production headless harness (`claude -p` / `codex exec`, skill + tools) as a HARD ship gate; bare-model results don't fully transfer (harness effects are real). Keep the deterministic seeded-defect metric (no LLM-judge → dodges judge bias).
  Ceremony: like E2D8S5, a research/eval spike shipping no product code — light on the feature done-gate. Next: start the corpus batch (new-domain clean base + determinism/vacuous-non-claim mutations).
