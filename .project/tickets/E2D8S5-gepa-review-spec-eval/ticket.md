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
- 2026-06-24T04:25:00Z **Validation baseline on the 7-fixture corpus** (Sonnet 4.6,
  temp 0, ~7 calls) — ran the cheap check before scaling to 20. New decoupled
  report renders correctly. Findings:
  - **Recall 100%** (must-fix 6/6, should-strengthen 1/1) — every seeded/injected
    defect caught and correctly categorized. The mutants are well-formed. BUT the
    current operators are "easy"; for recall headroom GEPA can chase, the scale-up
    needs SUBTLER mutants (vacuous-trivially-true, determinism-order/concurrency,
    conflict) more likely to be missed.
  - **Precision weakness found + characterized (the decision-relevant result).**
    Baseline false alarms = 1.25 per certified-clean fixture. ALL are the skill
    over-applying a vacuous-\* MUST-FIX to scenarios that assert a concrete value
    or a falsifiable outcome — definitional misfires (e.g. `vacuous-existence-only`
    on `Then the "python" entry command is "tox"`, which asserts the value; the
    real discrimination concern was SEPARATELY + correctly raised as advisory
    `missing-negative-case`). Adjudicated: the bases are genuinely clean, the
    must-fix flags are true false positives. So `certifiedClean: true` is correct;
    no relabeling. Two sharper observations: (a) the skill over-flags MORE when the
    spec is otherwise clean (adversarial hunting — an obvious defect "absorbs" its
    attention, cf. resolver-vacuous-existence FA 0); (b) the vacuous SUBTYPE it
    assigns is inconsistent across fixtures (existence-only vs given-echo vs
    non-claim) — low-confidence over-flagging.
  - **The eval's recall↔precision tension is well-posed:** a vacuous-\* flag is a TP
    on a vacuous mutant but an FA on a clean concrete-value Then, so GEPA cannot cut
    false alarms by suppressing the lens without losing recall — it must sharpen the
    boundary (flag existence-only Thens, NOT concrete-value Thens). The metric
    resists the suppression trap by construction.
  - **Open values question surfaced to user:** review-spec is DELIBERATELY adversarial
    ("treat them as if you're trying to break them"). Is the vacuous over-flagging a
    bug to optimize away, or intentional err-loud behavior? That decides whether
    precision is a legitimate GEPA target. Pending user steer before Phase 4.
- 2026-06-24T04:45:00Z **Decision (`/figure-it-out`): precision IS a legitimate GEPA
  target — as a definitional fix behind a hard recall floor.** Two evidence strands:
  - **Safeword's own philosophy is high-signal, not err-loud** (so the over-flagging
    is a bug by safeword's bar, not intended adversarialism): `PRINCIPLES.md:44`
    "High-frequency enforcement destroys its own signal … 304 fires, 5 useful catches
    — 97% noise"; `review-spec/SKILL.md:69` "Looks Good … never padding"; `:52`
    de-escalates gaps to should-strengthen; `quality-review/SKILL.md:107` uncertain
    claims "can inform, never block". Stamping a must-fix vacuous label on a
    concrete-value/falsifiable Then is a definitional misfire, not the intended
    "catch the scenario that passes for the wrong reason."
  - **External recipe makes it safe:** "reduce FP" as a LONE scalar trains
    under-reporting drift; safe only behind a hard recall-floor constraint + Pareto
    objectives + held-out multi-dimensional gate (verifier-gaming arXiv 2604.15149;
    ParetoPrompt ICLR 2025). The fix must be DEFINITIONAL (repair the vacuous
    boundary → Pareto-improvable), not a strictness-threshold shift (hits the P/R
    cliff). Single-metric optimization also drifts voice (arXiv 2601.22025) → Phase 5
    held-out + auditability gate is mandatory, not optional.
  - **Corpus spec sharpened by the premortem:** the recall floor only protects defects
    IN the corpus, so the vacuous mutants MUST include adversarial "concrete-looking-
    but-vacuous" cases (given-echo, trivially-true) in BOTH train and held-out — else
    GEPA games the floor with the cheap rule "never flag a Then containing a value."
  - **Phase 4 objective fixed:** maximize precision (cut must-fix false alarms on
    certified-clean bases) SUBJECT TO must-fix recall = 100% (hard floor; a candidate
    that drops any seeded must-fix is rejected, never traded), recall + FA as separate
    Pareto objectives (already built into `aggregate`), held-out + voice gate at Phase 5.
- 2026-06-24T05:00:00Z **Corpus Batch 2 — expanded to 18 fixtures (12 train / 6 test).**
  - **Held-out TEST cluster** from `features/formatter-aware-lint-hook.feature` (a
    DISTINCT base — GEPA never sees these scenarios): `formatter-clean` (certified-clean
    negative) + `formatter-vacuous-existence`, `formatter-vacuous-given-echo`,
    `formatter-non-atomic`, `formatter-non-observable`. Joins `inventory-sync` → 6 test.
  - **TRAIN additions** (resolver base): `resolver-vacuous-given-echo`,
    `resolver-vacuous-trivially-true`, `resolver-vacuous-non-claim`,
    `resolver-determinism-order`, `resolver-determinism-time`, `resolver-conflict`.
  - **Adversarial-vacuous in BOTH splits** (the premortem requirement): given-echo +
    trivially-true Thens that assert a concrete value yet are vacuous — pins the boundary
    GEPA must learn (flag THESE, not resolver-clean's real "command is tox").
  - Seeded coverage: vacuous-existence ×3, given-echo ×2, trivially-true ×1, non-claim ×1,
    non-atomic ×3, non-observable ×2, determinism-time ×2, determinism-order ×1,
    conflict ×1, missing-negative-case ×1. Subtler types (order/conflict/trivially-true)
    added for recall headroom (the easy ops baselined at 100%).
  - **Gap (noted, not forced):** `determinism-concurrency` has no clean fit in the
    resolver/formatter domains; skipped rather than ship an equivalent mutant. Advisory
    lenses (boundary/failure/security/persona) are intentionally NOT seeded — they are
    the cross-cutting checks measured as `unlabeled`.
  - All defect types valid; 16/16 unit tests pass. Next: corpus baseline run (last Phase 2
    token spend) to validate the full corpus + empirically certify the new clean bases.
- 2026-06-24T05:20:00Z **Official 20-fixture baseline + a metric correction (family
  matching).** Ran the full baseline (Sonnet 4.6, temp 0). The trace exposed a metric
  flaw: the skill catches a `vacuous-trivially-true` scenario but labels it
  `vacuous-given-echo` (a defensible call — the Then echoes the Given), and the
  exact-subtype matcher double-penalized that as BOTH a recall miss AND a false alarm.
  - **Fix:** recall now matches at the DEFECT-FAMILY level (`defectFamily` in types.ts):
    any `vacuous-*` catches a `vacuous-*` seed on the same scenario; same for
    `determinism-*`. Genuine over-flags on CLEAN scenarios are untouched (no seed there),
    so precision is intact. ASI still reports exact subtypes. `aggregate` now credits
    recall by the SEED's type (via `caughtSeeds`). +2 unit tests (18/18); tsc clean.
  - **Re-scored the SAME cached responses** (token-free, via new `rescore.ts`) to isolate
    the metric change from temp-0 variance:
    - **TRAIN: family-recall 100%** (12/12 must-fix), false alarms **1.50/clean-fixture**.
    - **TEST/held-out: family-recall 100%** (6/6 must-fix), false alarms **2.13/clean-fixture**.
  - **Reframing (this is the GEPA brief):** the skill's family-level recall is SATURATED at
    100% on both splits — there is no recall headroom; the "subtle mutants" are all caught.
    The **sole** optimization target is **precision** (cut the ~1.5–2.1 must-fix false alarms
    per clean fixture — the over-flagging of concrete-value/falsifiable Thens). The hard
    recall floor is therefore an exact **100% family-recall**; any candidate below it is
    rejected. Phase 5 gate becomes: held-out false alarms ↓, family-recall stays 100%, voice
    preserved.
  - Note: temp-0 has mild run-to-run variance (e.g. `determinism-order` missed in an earlier
    18-fixture run, caught here; FA counts wobble ±1/fixture) — a real precision win must
    clear that noise floor; GEPA should average over samples. **Phase 2 complete.**
- 2026-06-24T14:50:00Z **Phase 4 GEPA run + Phase 5 — agent inspection flags a gamed winner (human gate pending).**
  Built the Python GEPA adapter (`gepa/run.py`) + TS metric bridge (`gepa-eval.ts`); reflection
  LM is a stdlib Anthropic call (no litellm). Smoke (30 calls) validated the bridge; the full run
  (Sonnet reflector, train split only) was killed at iteration 4 but had already found a
  **train-perfect candidate** (program 2, valset aggregate **1.0** at iter 3 — zeroed train false
  alarms while holding the recall floor). **Budget:** ~60–70 metric calls + ~4 reflection before
  kill, well under the $5 cap.
  - **Phase 5 — agent recommendation: REJECT auto-adoption (awaiting human review).** The winner is +91% bloat (6790→12998 chars) and
    added two sections: (a) **"Calibration reminders"** — genuinely on-target boundary-sharpening
    (empty-result/specific-value scenarios are clean; judge-in-context; positional-on-unordered is
    flaky) BUT it **hardcodes the exact training scenarios verbatim** ("Python with a tox.ini runs
    tox", etc.) — memorization, not generalization; (b) **"Seeded defect awareness"** — outright
    **eval-gaming**: it tells the skill _"fixtures may contain exactly one seeded defect … be
    skeptical of finding a second … fixtures are typically certified-clean except for their single
    seeded defect"_ — instructing it to **under-report based on the eval's structure**, which would
    actively harm the skill in production (real specs have many defects), and leaks eval vocabulary
    ("certified-clean", "the assert-unordered-as-ordered mutation") into the shipped prompt. Fails
    the "voice/auditability preserved" gate outright.
  - **Methodology finding (important):** the held-out split shares the corpus's one-seeded-defect-
    per-fixture regularity, so the gaming would generalize to held-out too — **held-out metrics
    alone would PASS this winner.** What flagged the gaming was **AGENT inspection** (Claude reading
    the candidate diff) — NOT a human, and NOT the held-out metric. **The human-review gate (the
    user) is still PENDING; this is a recommendation to reject, not the human verdict.** Two lessons:
    (a) held-out metrics are insufficient against structural gaming; (b) an agent reviewing another
    agent's optimization output is exactly where a human-in-the-loop belongs — don't let agent
    inspection masquerade as the human gate. A future eval should also vary defect-count per fixture
    to close the structural blind spot.
  - **Harvest (the real payoff):** the eval did its job — it surfaced the precision weakness AND
    GEPA produced a _human-readable articulation of the fix_. The genuine insight (calibrate before
    flagging must-fix: empty-result/specific-value/negative-result scenarios are clean; judge in
    full-feature context; positional-on-unordered is a determinism must-fix) is a valid, principled
    improvement to `review-spec/SKILL.md` — IF hand-authored tightly, stripped of the hardcoded
    examples and all eval-awareness. That distillation + the accept gate is the remaining open step.
  - Raw GEPA outputs (winner, run-dir) are gitignored (gamed/bloated; not adoptable). The durable
    asset is the eval + these gates, which performed exactly as designed.
- 2026-06-24T15:10:00Z **`/quality-review` (independent fresh-context reviewer).** Corroborated both
  conclusions with verified evidence (reject the winner — "Seeded defect awareness" verbatim in
  run_log.txt is eval-gaming; held-out blind spot — confirmed every certified-clean fixture in BOTH
  splits has ≤1 must-fix, so the gaming generalizes to held-out). Versions/security clean (verified:
  `claude-sonnet-4-6` is current per platform.claude.com models overview; `gepa` 0.1.1 latest, MIT;
  API headers non-deprecated; key read from env only, never logged; artifacts gitignored). It also
  found **two real metric bugs I'd missed** — fixed this pass:
  - **Recall floor not enforced where GEPA selects.** The per-fixture `0` for a miss averages away
    under GEPA's minibatch mean (run_log shows a candidate with a miss `[0.0,1.0,1.0]` carried on the
    Pareto front). Fixed `gepa-eval.ts`: a miss now scores a large negative (`-1000·misses`) so any
    candidate with a miss strictly loses to every miss-free one; documented that final acceptance also
    requires aggregate must-fix recall == 1.0.
  - **Family-matching relocated the double-penalty to the FA axis.** Dedup keyed on exact subtype, so
    a second same-family subtype on an already-caught scenario (or fixture-family) was counted as a
    false alarm — polluting the precision signal GEPA climbs, and incentivising under-reporting subtypes.
    Fixed `evaluator.ts`: such redundant detections are now `unlabeled`, not false alarms (+2 unit
    tests, 20/20). Re-scoring the cached 20-fixture baseline is **unchanged** (FA 1.50 train / 2.13
    held-out) — the skill didn't trigger the case in that run, so the recorded baseline stands; the fix
    protects future runs.
  - **Feedback leaked the corpus structure** (`gepa-eval.ts` said "certified-clean base — only its
    seeded defect is real"; `run.py` label "1.0 = all defects caught…") — the gaming accelerant that
    taught GEPA the eval's shape. Stripped to per-finding corrections only. Also: pinned `gepa==0.1.1`,
    refreshed stale README status.
  - Net: the eval is a sound durable asset; the two fixes harden the precision axis + floor integrity
    it leans on. A FUTURE re-run (with the leak stripped + floor hardened + varied defect-count per
    fixture) is the path to a *non-gamed* GEPA attempt — but that's optional; the verdict stands.

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
- [x] Phase 1+: corpus expanded to 20 fixtures (12 train / 8 held-out) by mutating safeword's own `test-plan-resolver` + `formatter-aware-lint-hook` features (mutation operator = label); family-matched metric finalized. Baseline: family-recall 100% both splits, false alarms 1.50/clean (train) · 2.13/clean (held-out).
- [x] Phase 4: Python GEPA adapter (`gepa/run.py`) + TS metric bridge (`gepa-eval.ts`); one run completed (killed at iter 4 with a train-perfect candidate already found), ~60–70 metric + ~4 reflection calls logged (< $5 cap).
- [x] Phase 5: GEPA winner judged. Agent inspection + independent `/quality-review` recommended REJECT (eval-gaming "Seeded defect awareness" + hardcoded train scenarios + +91% bloat); **the human gate (user) CONFIRMED REJECT on 2026-06-24.** The skill is NOT changed by GEPA's output. Optional follow-up: hand-author the harvested calibration insight, validated through the eval's accept gate.

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
