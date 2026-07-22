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
- 2026-07-22 **Corpus Batch 3 (tracker domain) — authored; certification running.** New HELD-OUT domain from `features/sync-tracker.feature` — a 2ND held-out domain (E2D8S5 held-out was formatter-only, too thin to measure a subtle precision change). 4 fixtures, shared clean tail (scenarios 2–3 byte-identical), scenario 1 varied:
  - `tracker-clean` — certified-clean negative (concrete Thens: open / no-calls / closed).
  - `tracker-determinism-order` — assert-unordered-as-ordered on the label SET (priority family).
  - `tracker-vacuous-non-claim` — Then-to-non-claim ("the sync does not error") (priority family).
  - `tracker-non-observable` — externalize→internalize ("internal projected flag").
  All `split: test`. Certification (review-spec on the 4, Sonnet 5, via `op`) BACKGROUNDED (`bkfsxi1cf`). Gate before commit: `tracker-clean` draws 0 must-fix (else adjudicate/fix the base), each mutant's seed is caught. NOT committed until certified.
- 2026-07-22 **Batch 3 CERTIFIED + committed.** Certification (Sonnet 5, op — needed 2 tries, op auth prompt was dismissed on the first): `tracker-vacuous-non-claim` seed caught (0 FA); `tracker-non-observable` seed caught (+1 vacuous over-flag); `tracker-clean` clean — its 1 FA is the skill over-flagging the absence-assertion "received no calls" as vacuous (a known behavior, not a base defect → `certifiedClean` stands; the fixture is now a precision probe for that over-flag). `tracker-determinism-order` seed **MISSED** — the blind spot, now confirmed in a **3rd domain** (resolver/formatter/tracker), reinforcing tonight's sweep. Corpus **23→27**; 29/29 tests green. Next batch: a TRAIN-split domain weighted to determinism-order (the signal needs train coverage + repeats to settle Fable-only-vs-noise), then the 3-way feedback/pareto/test restructure.
