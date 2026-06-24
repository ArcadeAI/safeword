---
id: E2D8S5
slug: gepa-review-spec-eval
type: feature
phase: intake
status: in_progress
created: 2026-06-24T02:04:25.443Z
last_modified: 2026-06-24T02:04:25.443Z
---

# GEPA prompt optimization for the review-spec skill

**Goal:** Use GEPA (reflective prompt evolution) to measurably improve the
`review-spec` skill, leaving behind a reusable behavioral eval as the durable
asset whether or not GEPA itself ever ships a change.

**Why:** Safeword has ~11,500 lines of hand-tuned prompts but no metric that
scores prompt _behavior_. `review-spec` is the one skill whose output is
objectively scoreable (seed a `.feature` file with known defects, measure how
many it catches), so it is the only place GEPA's value is even testable. The
eval is high-leverage on its own as the first behavioral regression guard for a
skill. Origin: `/figure-it-out` session (Option A — narrow offline GEPA pilot
gated behind a seeded-defect eval).

## Work Log

- 2026-06-24T02:05:00Z Scaffolded Phases 1-3 under `experiments/gepa-review-spec/`:
  dataset/task/evaluator seams + harness, deterministic set-matching metric (no
  LLM judge), seeded-defect corpus (3 seed fixtures), baseline runner. 12/12
  unit tests pass. (refs: branch `claude/geppa-optimize-anything-icmta2`)
- 2026-06-24T02:05:00Z Added `experiments/` to ESLint ignores (out of tsconfig
  surface, like `scripts/`/`features/`).
- 2026-06-24T02:05:00Z Blocked: Phase 3 baseline needs a live `ANTHROPIC_API_KEY`,
  not available in the web session. This is the cheapest test of the riskiest
  assumption (can the skill's free-form findings be parsed and scored reliably?).
- 2026-06-24T03:33:00Z **Phase 3b — real baseline ran** (claude-sonnet-4-6, temp 0,
  3 fixtures, key injected via `op run`). Added a `SAFEWORD_EVAL_TRACE=1` mode
  (`runEvalWithTraces`) that prints each fixture's raw response + TP/FP/FN diff.
  - **Baseline F1:** TRAIN **66.7%** (P 50.0% / R 100.0%, tp 4 fp 4 fn 0);
    TEST/held-out **0.0%** (P 0.0% / R 100.0%, tp 0 fp 3 fn 0).
  - **Parsing: rock-solid.** 3/3 responses emitted one well-formed trailing
    `json` block; every `defectType` was a valid enum value; every scope (pinned
    vs `*`) was correct. The parser correctly ignored the `gherkin` fences in the
    skill's proposed-fix blocks. **No `EVAL_OUTPUT_CONTRACT` change needed.**
  - **Recall: trustworthy.** 100% across all 3 fixtures — every seeded defect was
    caught, correctly categorized, and pinned to the right scenario. Auto-score
    matches a human read on the recall side.
  - **Precision: NOT trustworthy as labeled — the decision-relevant finding.**
    All 7 "false positives" are _legitimate_ review-spec findings, not
    hallucinations: e.g. `vacuous-given-echo` on the partial-refund Then (50−20=30
    is arithmetic on the Given), `vacuous-existence-only` on "the session is
    expired" (a label, not a falsifiable observable), a self-contradictory
    active/ended `Then`, and — on the _clean_ held-out fixture — `boundary`
    (no zero-stock scenario) and `failure` (no malformed-payload scenario). The
    corpus is **under-labeled**, and the "a clean fixture measures false
    positives" assumption is **broken for the cross-cutting lenses**: boundary /
    failure / missing-negative-case fire on _any_ non-exhaustive spec by design,
    so flagging them is correct behavior, not a false alarm.
  - **Implication (gates Phase 2+4):** recall on seeded defects is the only
    trustworthy scalar today. Expanding to 20 fixtures + running GEPA against the
    current F1 would let GEPA _game precision by suppressing real findings_ —
    actively degrading the skill while the metric climbs. The scoring contract
    needs an honesty fix (severity-split P/R + mutation-certified-clean bases)
    before corpus expansion. Surfacing to user before proceeding past the
    "only if 3b looks trustworthy" gate. (refs commit `1dc4ae0e`)
- 2026-06-24T04:12:00Z **Scoring-honesty decision (`/figure-it-out`, user-approved).**
  Three literatures converged on one design (citations in ticket discussion):
  - **Precision over an under-labeled positive corpus is formally unidentifiable**
    (PU learning, Elkan & Noto 2008) — so don't try to measure it there. Treat an
    unmatched finding on a non-certified fixture as _unlabeled, not wrong_ (IR
    "unjudged ≠ wrong" / bpref, Buckley & Voorhees 2004).
  - **Manufacture trustworthy negatives:** false-alarm rate depends only on the
    negative cells, so a _certified-clean_ base measures it exactly with zero
    positive labeling. A single-mutation fixture (one injected defect over a
    certified-clean base) is both a recall probe and a precision probe.
  - **Severity is harness-derived from defect TYPE, never model-reported** — a
    model-reported severity would let GEPA dodge the false-alarm signal by
    downgrading every finding to should-strengthen (a fresh suppression vector).
  - **Kill the single F1 headline** (it was the gameable scalar); report recall +
    false-alarm rate separately. Guard GEPA with a recall floor on must-fix +
    frozen held-out + tripwires (Amodei et al. 2016; Manheim & Garrabrant 2018);
    GEPA's Pareto front + per-instance `{score, feedback}` support this natively.
  - **Premortem mitigation baked in:** a "clean" base is only eligible after
    review-spec is run on it and every must-fix adjudicated to zero (found-clean
    specs are 35–60% mislabeled in the literature). Equivalent-mutant curation is
    manual for Gherkin (no compiler → no TCE); one mutation per fixture.
- 2026-06-24T04:12:00Z **Refactored the scoring contract** (`evaluator.ts` + seams,
  pure/no-tokens, gates Phase 2+4):
  - `DEFAULT_SEVERITY: Record<DefectType, Severity>` in `types.ts` (structural →
    must-fix; coverage lenses → should-strengthen). `Fixture.certifiedClean` added;
    `dataset.ts` parses it.
  - `scoreFixture` now emits `truePositives` / `falseNegatives` / **`falseAlarms`**
    (must-fix unmatched on a certified-clean base ONLY) / **`unlabeled`** (every
    other unmatched finding — never penalized). `aggregate` reports `recall`
    (primary) + `mustFix`/`shouldStrengthen` tallies + `falseAlarms`/`cleanFixtures`/
    `falseAlarmRate` + `unlabeled`; **no `f1`/`precision` headline.**
  - `inventory-sync` marked `certifiedClean: true` (Phase 3b adjudicated it: only
    advisory findings, zero must-fix — exactly the certification the premortem
    requires).
  - 16/16 unit tests pass (was 12; +4 lock the new semantics); `tsc --strict` clean
    on `src/`.
- 2026-06-24T04:30:00Z **Phase 2 corpus expansion — approach + Batch 1.** Pattern:
  excerpt a small (3-scenario) CLEAN base from a real safeword `.feature`, hand-
  adjudicate it clean, then apply ONE semantic **mutation operator** per fixture
  (the operator IS the label). The unmutated base is a certified-clean NEGATIVE;
  each single-mutation variant is a POSITIVE (certifiedClean=true) whose only
  must-fix is the injected one, so any other must-fix on it is a true false alarm.
  Held-out TEST split will use DISTINCT bases so GEPA never sees those scenarios.
  Mutation operator → defect-type table (must-fix unless noted):
  `weaken-Then-to-existence`→vacuous-existence-only · `echo-the-Given`→vacuous-given-echo
  · `precondition-into-assertion`→vacuous-trivially-true · `Then-to-non-claim`→vacuous-non-claim
  · `merge-scenarios`→non-atomic · `externalize→internalize`→non-observable
  · `add-wall-clock`→determinism-time · `assert-unordered-as-ordered`→determinism-order
  · `unsequenced-concurrency`→determinism-concurrency · `contradict-a-sibling`→conflict
  · `delete-the-rejection-scenario`→missing-negative-case (should-strengthen, fixture-scope).
  **Batch 1** (from `features/test-plan-resolver.feature`, all TRAIN): `resolver-clean`
  (certified-clean negative) + `resolver-vacuous-existence`, `resolver-non-observable`,
  `resolver-non-atomic`. Corpus now 7 fixtures (6 train / 1 test); all defect types
  valid, label severities consistent with `DEFAULT_SEVERITY`; 16/16 tests still pass.
  Next: scale to ~20 across more bases incl. a held-out TEST cluster, then a corpus
  baseline run (the only token spend in Phase 2 — also empirically certifies the
  clean bases: a must-fix on any certifiedClean fixture flags a base to harden).

---

## Scope

**In scope:**

- A behavioral eval for `review-spec`: seeded-defect corpus + deterministic
  metric + baseline.
- A narrow, offline GEPA pilot that evolves only `review-spec/SKILL.md`.
- Decoupled dataset/task/evaluator seams so a LangSmith or Phoenix adapter is a
  drop-in later (not built now).

**Out of scope:**

- Optimizing any other skill or prompt (voice/philosophy docs are subjective —
  machine-evolution threatens auditability).
- Wiring GEPA into CI / continuous optimization.
- Adopting LangSmith or Arize as a dependency now (YAGNI; seams keep the door
  open).

## Acceptance Criteria

- [x] Phase 1: seeded-defect corpus with labeled `*.expected.json` + train/test split.
- [x] Phase 2: deterministic scorer — revised for precision-honesty to recall (primary) + false-alarm rate on certified-clean bases + per-defect ASI; F1/precision-over-positives dropped as unidentifiable (see work-log 04:12Z).
- [x] Phase 3a: baseline runner wired (`src/baseline.ts`).
- [x] Phase 3b: baseline ran on a live key; parsing rock-solid and recall (100%) confirmed against a human read on all 3 seed fixtures. Surfaced that precision-as-labeled was untrustworthy → drove the scoring-contract refactor.
- [ ] Phase 1+: corpus expanded to ~20 fixtures, ideally via mutation of safeword's own shipping `.feature` files (mutation operator = ground-truth label).
- [ ] Phase 4: Python GEPA adapter that calls this harness as its metric; one optimization run completed within a logged token budget.
- [ ] Phase 5: GEPA winner judged on the **held-out** split + human review; accepted only if held-out detection ↑, FP not worse, and voice/auditability preserved.

### Risks

- **Riskiest assumption:** the skill's free-form findings parse/score reliably.
  Cheapest test: baseline on the 3 seed fixtures before expanding the corpus. If
  noisy, tighten `EVAL_OUTPUT_CONTRACT` in `src/task.ts` (the eval wrapper —
  never the shipped skill).
- **Overfitting:** GEPA could overfit injected defects. Mitigate: hold out a
  test split GEPA never sees; gate the final winner on held-out + human review,
  never the training score.

### Related Files

- `experiments/gepa-review-spec/` — the scaffold (README, src seams, fixtures, tests).
- `experiments/gepa-review-spec/src/adapters/README.md` — GEPA / LangSmith / Phoenix adapter notes.
- `.claude/skills/review-spec/SKILL.md` — the optimization target (untouched until Phase 5).
