---
id: 0XEMEE
slug: retro-extraction-recall
type: feature
phase: intake
status: in_progress
parent: RV9JT4-retro-transcript-mining
scope: |
  Improve retro's automated extraction YIELD and TIER. A head-to-head eval (this
  session) corrected an early over-claim: extraction is NOT "near-zero" — sonnet
  returned 9 valid, high-value safeword findings; haiku returned 1-3 weak ones.
  The "0/5 vs the 5 a human filed (#564-#568)" metric was misleading — it scored
  exact agreement with one human's selection, not validity. The session held 15+
  real frictions; the models found OTHER valid ones. Three real problems remain:

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
