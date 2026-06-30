---
id: 0XEMEE
slug: retro-extraction-recall
type: feature
phase: implement
status: in_progress
parent: RV9JT4-retro-transcript-mining
scope: |
  Improve retro's automated extraction YIELD and TIER. A head-to-head eval (this
  session) corrected an early over-claim: extraction is NOT "near-zero" — sonnet
  returned 9 valid, high-value safeword findings; haiku returned 1-3 weak ones.
  The "0/5 vs the 5 a human filed (#564-#568)" metric was misleading — it scored
  exact agreement with one human's selection, not validity. The session held 15+
  real frictions; the models found OTHER valid ones. FOUR problems remain, and
  D (timing) dominates the rest:

  D. TIMING — Phase 0, the dominant lever. The extractor fires once per session
     at the FIRST Stop where the transcript shows >= 3 tool-use events
     (`decideRetroRun` + `SUBSTANCE_THRESHOLD = 3`), then the once-per-session
     sentinel suppresses it forever. Concept-tested on THIS session's raw
     transcript: the first qualifying Stop lands at line 19 of 9,788 — 0.2% in —
     while #567 isn't discovered until line 2,836 (29%) and full coverage isn't
     reached until ~line 4,894 (50%). So fire-once-early reads the session's
     OPENING and is structurally blind to everything after. No tier (A) or
     coverage (B) choice can recover findings from turns that haven't happened
     yet when the extractor runs. Fix direction: re-arm — run extraction on later
     substantial Stops too, and lean on the occurrence ledger (RV9JT4) to dedupe
     filings, so the LAST fire before the session goes quiet sees ~the whole
     session. There is no SessionEnd hook in cloud (killed before async work
     finishes; transcript deleted on container reclaim), so a late Stop is the
     only "near-end" handle. See the steelman below.
  A. TIER. haiku (the hardcoded default, retro.ts:113) is too weak — 1-3 generic
     findings. sonnet found 9 strong ones (incl. a real stack-frame-leak security
     bug). But sonnet cost ~242s/run vs haiku ~75s — a direct #563 cost tension.
     Decide the default tier (or a cheap-prefilter -> strong-extract escalation)
     against cost.
  B. COVERAGE (not recall). Some genuinely high-value items are still missed by
     every tier (e.g. #568 cloud-filing) because the friction-dense digest HEAD
     crowds out later material. buildDigest does `digest.slice(0, cap)` (180 KB =
     8.1% of this 2.2 MB digest, HEAD only) so the session tail is structurally
     invisible. Fix direction: whole-transcript selection — chunk-and-map, or
     friction-ranked + head/tail — not a head slice.
  C. EVAL METRIC. There is no ground-truth "the 5 findings" — exact-match is the
     wrong yardstick. Need a validity/coverage-based eval (are findings real
     safeword frictions? are the known high-value ones surfaced?), not string
     agreement with one hand-picked set.
out_of_scope: |
  - Transport (BNGK9W / #568) — separate; delivery, not extraction quality.
  - Robust dedup against existing issues — separate concern (was queued as
    "1FGE1C" but never actually filed; re-scope if still wanted).
  - Cost-bounding / friction-gated firing (#563) — related (tier cost feeds it)
    but the gating mechanism itself is #563's.
done_when: |
  - TIMING (Phase 0): extraction is no longer pinned to the first qualifying Stop.
    A later Stop runs extraction over the fuller transcript, and re-fires file no
    duplicates (occurrence ledger). A test proves: (1) a finding that only appears
    AFTER the first qualifying Stop is still surfaced; (2) re-fires don't re-file
    an already-filed finding.
  - A tier decision is made and implemented (default model and/or escalation),
    justified against the measured cost (haiku ~75s/1-3 findings vs sonnet
    ~242s/9 findings) — not left hardcoded to haiku by default.
  - buildDigest no longer drops the tail of a long session: a unit test proves a
    friction signal near the END of an oversized transcript survives into the
    digest the extractor sees.
  - A validity-based eval harness exists (fixture transcript + a scorer that
    checks findings are real safeword frictions and that known high-value items
    are surfaced), so future prompt/model/digest changes are regression-guarded.
    NOT exact-match against a frozen hand-picked set. Scenarios green; /verify +
    /audit pass.
created: 2026-06-30T06:15:02.222Z
last_modified: 2026-06-30T06:15:02.222Z
---

# Retro extraction: tier too weak by default, coverage gaps on long sessions

**Goal:** Make the automated retro extractor reliably surface valid, high-value
safeword friction — by raising the default tier (justified against cost) and
covering the whole transcript, not just its head.

## How it works, end to end (plain-English capture)

The invisible retro reviews a session for safeword's OWN friction and files
issues — invisibly (no chat output; headless `claude -p`, 7D8PJP). Three things
were broken; this ticket fixes them in order.

1. **WHEN it runs (Phase 0 — this slice, IN PROGRESS).** Today it runs ONCE, at
   the first Stop with ≥3 tool-uses — which is ~0.2% into a real session — then
   never again, so it only ever sees the opening. Fix: **re-arm.** Record the
   tool-use count at each run; run again on a later Stop once the session has grown
   by ~250 tool-uses (ADDITIVE cadence — geometric front-loads and goes blind on
   the back 60%). So the LAST run before the session goes quiet sees ~the whole
   session (~95% in simulation). A high fire-cap (~20) is only a runaway guard.
   Re-runs that re-surface an already-filed finding open NO duplicate — the
   existing occurrence ledger (RV9JT4) dedupes. Never blocks Stop; recursion-guarded.
2. **WHICH model (Phase A — next).** Today's default is haiku, proven too weak
   (1–3 weak findings vs sonnet's 9 strong on the same session). Default → sonnet.
3. **HOW MUCH it sees per run (Phase B — later).** The digest keeps only the first
   180 KB (8.1%) of a long session. Fix: whole-transcript selection (chunk-and-map),
   measured by an eval scorer (Phase C) instead of exact-match against a human set.

**Cost:** sonnet × re-runs, bounded by additive cadence + fixed per-run digest cap

+ dedup + the #563 "new friction since last run" gate. Typical session ~$0.35–1;
a rare 25 MB session ~$2.80 (G=250). PROVISIONAL pick (G≈250, sonnet) made when the
cost question couldn't be asked interactively — reversible via config; confirm.
Future cost win: fire once after the session goes quiet (debounce) — blocked on
cloud container-reclaim-timing, the same gap that ruled out a SessionEnd hook.

**See:** [spec.md](./spec.md) once authored.
**Parent:** RV9JT4. **Siblings:** 7D8PJP (built extraction), BNGK9W (#568, transport).

## The eval that motivated this (run live, this session)

Head-to-head on the **same** 25 MB transcript, comparing model tiers on the
shipped extractor (`buildDigest` -> `claude -p` with `EXTRACT_SYSTEM_PROMPT`):

| Run | Findings | Quality | Matched the 5 a human filed (#564-#568) | Time |
| --- | --- | --- | --- | --- |
| haiku @180 KB (shipped) | 1 | weak/generic | 0/5 | ~50 s |
| haiku @400 KB | 3 | mediocre | 0/5 | ~75 s |
| sonnet @400 KB | **9** | **all valid, high-value** | 0/5 | **~242 s** |

**Correction to an earlier over-claim in this ticket's first draft:** extraction
is NOT "near-zero." sonnet found 9 real safeword frictions (stale-dist test
failures, the hook-coverage smoke gate firing only after a 14-min run, dogfood
parity needing manual `cp`, a real **stack-frame substring secret-leak**,
markdownlint rejecting `#NNN` lines, parity not covering Cursor/Codex, env-sniff
harness detection). All legitimate; several higher-value than the hand-picked 5.

**Why "0/5" is misleading:** there is no canonical "5 findings." The session held
15+ real frictions; "#564-#568" was one human's selection at one moment. The
models surfaced OTHER valid frictions, so exact-match against that set scores
disagreement-of-selection, not failure-of-extraction.

**What's genuinely wrong (measured):**

- **Tier:** haiku (hardcoded default) is too weak — 1-3 generic findings. sonnet
  yields 9 strong ones, but at ~242 s/run vs ~75 s (a #563 cost tension).
- **Coverage:** `buildDigest` does `digest.slice(0, cap)` — 180 KB = **8.1%** of
  this 2.2 MB digest, **HEAD only**. The friction-dense head crowds out later
  material, so high-value tail items (e.g. #568, signal at char 192,514; #567 at
  976,366) are missed by every tier. Raw 24,999,232 B -> digest 2,225,297 chars.
- **Metric:** exact-match vs a frozen hand-picked set is the wrong yardstick;
  need a validity/coverage scorer.

Takeaway: the invisible-retro pipeline (7D8PJP) and transport (BNGK9W) work, but
the extractor's DEFAULT tier under-delivers and its digest can't see the whole
session. Raising the tier + whole-transcript coverage is the lever — consistent
with `natural-vs-self-report-gates.md` (cheap self-report is the weak link).

## Timing — the dominant lever (concept-tested on this session)

`decideRetroRun` fires extraction at the **first** Stop where the transcript shows
`>= SUBSTANCE_THRESHOLD` (3) tool-use events, then the once-per-session sentinel
suppresses it for the rest of the session. Three tools is reached almost
immediately, so the extractor reads the session's OPENING.

**Concept test (this session's raw 25 MB transcript, no model calls):**

| Marker | Line (of 9,788) | % through session |
| --- | --- | --- |
| First qualifying Stop (cum tool_use >= 3) — **the trigger** | **19** | **0.2%** |
| #564 multiple-in_progress first appears | 152 | 1.6% |
| #567 dry-run first appears (organic) | 2,836 | 29% |
| Full 5/5 coverage reached | ~4,894 | ~50% |

Recall ceiling (signal *availability*, before extraction even runs):

- fire-once at the first qualifying Stop (line 19): **2/5** — and both are
  compaction-summary echoes at lines 1-2; in a fresh session with no summary
  header the trigger-window ceiling is **~0/5**.
- fire at session end: **5/5**. Re-arming climbs monotonically (25%→4/5, 50%→5/5).

So timing caps recall *before* tier or coverage get a vote. Fix it first.

### Steelman — re-arm extraction (fire on later Stops, dedupe via the ledger)

The strongest case for re-arming rather than firing once:

1. **It's the only way to see the whole session in cloud.** There is no usable
   SessionEnd hook (killed before async finishes; transcript deleted on container
   reclaim), so a Stop is the only live handle — and only the *last* Stop's
   transcript contains the whole session. Firing once-early reads 0.2%; only
   re-arming guarantees a fire that reads ~100%.
2. **The dedupe infrastructure already exists.** The occurrence ledger (RV9JT4)
   makes re-files idempotent — a later fire that re-surfaces an earlier finding
   doesn't open a duplicate. So the cost of re-arming is *compute*, not tracker
   noise, and the existing 5-new-issues/session cap still holds.
3. **Cost is bounded and tunable, not unbounded.** Gate re-fires on transcript
   GROWTH (e.g. +K tool-uses since the last fire), not every Stop — a handful of
   fires per long session. Combined with the #563 friction gate, a re-fire only
   does real work when the session both grew and hit new friction.
4. **It degrades gracefully — never worse than today.** Short session that ends
   after the first fire? You got exactly the current behavior. Long session? Each
   later fire strictly improves coverage. There is no input on which re-arm loses
   to fire-once.
5. **It turns the tier-cost objection around.** Re-arm can run the CHEAP tier
   (haiku) on the incremental fires for early signal and escalate to sonnet
   chunk-and-map only on the final/largest fire — so the expensive pass runs once,
   over the fullest transcript, instead of the cheap pass running once over the
   emptiest.

Residual objection (honest): in a pathological very-long session, re-arm fires
several times; worst case is N extractions for <=5 filings. Mitigation is the
K-growth gate + #563 friction gate + cheap-incremental/escalate-once tiering
above. The objection bounds the *cost*, it doesn't restore *fire-once* recall.

## Work Log

- 2026-06-30T06:15Z Created from a live head-to-head eval (initially framed as
  "0/5 recall, near-zero"). Next: spec.md, then decide digest strategy.
- 2026-06-30T06:30Z CORRECTED after the sonnet run: extraction is NOT near-zero.
  sonnet @400 KB returned 9 valid high-value findings (~242 s); haiku 1-3 weak
  ones. The "0/5 vs the human-filed 5" metric was misleading (no canonical set;
  15+ real frictions in the session). Reframed scope/title/done_when to the three
  real problems: TIER (haiku too weak by default vs cost), COVERAGE (head-only
  digest misses the tail), and METRIC (need validity-based eval, not exact-match).
  Next: figure-it-out on tier (default vs cheap-prefilter->strong escalation) +
  whole-transcript digest, with these numbers as evidence.
- 2026-06-30T07:40Z BDD: scoped this pass to Phase 0 (TIMING re-arm); tier/coverage/
  eval-scorer are later phases. Authored spec.md (SM persona, TB1/TB2/TB3/NTB1
  JTBDs), dimensions.md (8 dimensions), the 12-scenario feature
  (`retro-rearm-timing.feature`), and the R/G/R ledger. Advanced to scenario-gate.
- 2026-06-30T07:41Z Scenario-gate PASSED — independent fork review (sonnet,
  fresh context, /review-spec) returned GATE: PASS, 0 blocking, 6 non-blocking
  step-authoring heads-ups (add injectable count-writer seam; export count-state
  read/record at the right granularity; assert on the count VALUE not file
  existence; treat TB2.AC2/AC3 as two-call/integration with a stateful readFile;
  mock the spawn boundary; document the resolver-precedence reuse). Stamp recorded.

  **Proof plan & build order (leaf-first, outside-in TDD; boundaries mocked = the
  `claude -p` spawn, the GitHub transport, and the count-state file via injected
  baseDir/writer):**
  1. Count-state helpers in retro-trigger.ts (+ `.safeword` mirror):
     `readLastFiredCount(sessionId, baseDir)` / `recordFiredCount(sessionId, count,
     baseDir)`, keyed by the resolved session id. Unit — proves NTB1.AC2 (keying)
     and the storage seam. Replaces the boolean sentinel file with a count file.
  2. `REARM_GROWTH_THRESHOLD` + the re-arm decision (a `decideRetroRun` successor,
     injected deps). Unit — proves TB1.AC1 (first fire + records count; trivial
     doesn't), TB2.AC1 (re-fire at/above growth; hold below), NTB1.AC1 (recursion
     guard FIRST; fail-open when record throws). Assert on the count value.
  3. TB2.AC2 — two-call unit with a stateful `readFile` (short then grown): the
     re-fire reads the CURRENT transcript.
  4. TB2.AC3 — integration: injected extractor over the grown transcript → a
     back-half finding reaches `prepareEncounters`' input (spawn mocked).
  5. TB3.AC1 — dedupe: a re-fire's already-filed manifestation opens no issue, a
     new manifestation files (occurrence ledger, RV9JT4). Confirm the ledger is
     consulted on the `--auto-extract` path before claiming done.
  6. `stop-retro.ts` (+ mirror) wiring: the hook uses the re-arm decision instead
     of the once-per-session sentinel.
  Open impl question to settle in piece 2: the `REARM_GROWTH_THRESHOLD` value
  (start ~25 tool-uses; tune so a long session re-fires a handful of times, not
  every Stop).
- 2026-06-30T08:01Z CHECKED THE PLAN AGAINST THIS SESSION (sim-rearm.ts) — and it
  FAILED twice, corrected both:
  (1) Cadence: GEOMETRIC backoff front-loads — last fire at 38%, 62% blind tail
  (its "5/5" was a compaction-summary artifact). Friction-gating is worse (3,622
  friction lines → exhausts a 5-cap by 7%, 93% blind tail). Fix: ADDITIVE cadence
  (every ~200 tool-uses, no low cap, high backstop) → last fire 91–100%, full
  coverage. The low cap was the bug.
  (2) Model: HAIKU is too weak (proven: 1–3 vs sonnet's 9) — re-arming it re-reads
  the session badly. Fix: default to SONNET (folds in lever-A's cheap first step).
  Honest cost with sonnet+additive: typical session ~$0.35–1; pathological 25 MB
  session ~$3–5 (G=250→$2.80/8 fires). Per-fire input fixed (digest cap); dedup +
  #563 friction gate trim typical sessions. Worst-case cost is the OPEN #563 value
  call. Future win: debounce-to-quiet = one ~$0.35 end-fire (blocked on cloud
  reclaim-timing characterization). impl-plan Decisions/approach/triggers updated.
- 2026-06-30T14:40Z IMPLEMENT piece 1/6 GREEN: re-arm state helpers in
  retro-trigger.ts (+ `.safeword` mirror) — `RearmState {lastCount, fires}`,
  `rearmStatePath`, `readRearmState` (fail-open on missing/corrupt), `recordFire`;
  `REARM_GROWTH=250` + `MAX_FIRES=20` constants. 6 new unit tests (keying,
  round-trip, re-fire overwrite, path-sanitize, corrupt-fail-open); 35/35
  retro-trigger pass. NTB1.AC2 ledger row checked. NEXT piece 2: the additive
  re-arm decision (`decideRetroRun` successor) — TB1.AC1/TB2.AC1/NTB1.AC1.
- 2026-06-30T07:28Z Added the TIMING lever (Phase 0) after a "when does it run"
  question. Concept-tested on this session's raw transcript: the trigger fires at
  line 19/9,788 (0.2%), but #567 isn't seen until 29% and full coverage not until
  ~50% — so fire-once-early reads only the opening and caps recall before tier or
  coverage matter. Folded in the re-arm fix + steelman; reordered done_when so
  timing is Phase 0, ahead of tier/coverage. Re-arm cost is the #563-gated value
  call for the user.
