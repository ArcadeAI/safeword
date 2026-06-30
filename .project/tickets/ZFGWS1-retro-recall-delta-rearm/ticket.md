---
id: ZFGWS1
slug: retro-recall-delta-rearm
type: feature
phase: intake
status: in_progress
parent: RV9JT4-retro-transcript-mining
scope: |
  Fix the invisible retro's RECALL as ONE coherent slice (the levers are coupled;
  no incremental phase works alone — proven by /quality-review on the prior
  0XEMEE plan, which this ticket supersedes). The decided design (/figure-it-out):

  1. DELTA RE-ARM. The retro fires more than once per session. Each fire digests
     only the NEW activity since the last fire (a bounded window over the transcript
     by byte/line offset, with a small overlap into the previous window for
     boundary context). The deltas TILE the whole session, so late-session friction
     is actually read — defeating the digest head-cap that made plain re-arm inert.
     Re-fire cadence: additive growth since the last fire (~REARM_GROWTH tool-uses),
     high runaway backstop (~20), gated by #563 "new friction since last fire".
  2. SONNET. Default the extraction model to sonnet (haiku proven too weak: 1–3
     weak vs 9 strong on the same session).
  3. ASYNC EXECUTION. Register the retro Stop hook with `async: true` (documented
     Claude Code hook mode: returns immediately, runs in background, 600s timeout)
     so re-fires NEVER block the user's session. NOT `asyncRewake` (it surfaces
     stderr into the chat → breaks invisibility). Replaces the current blocking
     `spawnSync` in stop-retro.ts.
  4. SIGNATURE DEDUPE. Re-fires must not open duplicate issues. Match on the
     content `signature` (retro:hash), not the model-generated title (titles vary
     across fires). Forward a stable session id to the extractor child (today it
     falls back to `'unknown'`, breaking ledger session-accounting).
  5. CONCURRENCY. The re-arm offset state read→write must not double-fire on two
     near-simultaneous Stops (atomic write / lock).
out_of_scope: |
  - Transport/filing in cloud (BNGK9W / #568) — the fallback if cloud reclaim
    proves to kill in-hook async work; not this ticket's mechanism.
  - Whole-transcript chunk-and-map per fire — REJECTED in figure-it-out (~M×N
    calls / ~$15 vs delta's ~M / ~$1.44) for a marginal global-pattern gain the
    ledger's recurrence count already covers.
  - A validity/coverage eval scorer — still wanted as a regression guard, but
    spun out separately so this slice ships; re-scope if it should ride along.
done_when: |
  - A finding that appears only in the BACK HALF of a session is filed: a test
    proves a friction in a late delta reaches the egress pipeline (the recall win).
  - Re-fires open NO duplicate for the same signature; a genuinely new signature
    files. Dedupe is by signature, not title; a stable session id reaches the child.
  - The retro Stop hook does not block: it is registered `async: true` and returns
    immediately; a test asserts the non-blocking contract (no synchronous wait on
    the extraction).
  - Delta windowing: a test proves fire N over a grown transcript digests the
    window SINCE fire N-1 (not the head), with overlap; union of deltas covers the
    session.
  - Two near-simultaneous Stops do not double-fire (atomic offset state).
  - Cadence bounded (additive + backstop + #563 friction gate); fail-open, never
    breaks Stop; recursion-guarded. Scenarios green; /verify + /audit pass.
created: 2026-06-30T15:03:00.000Z
last_modified: 2026-06-30T15:03:00.000Z
---

# Retro recall: delta re-arm + sonnet + async hook + signature dedupe

**Goal:** Make the invisible retro actually surface the friction a session hits —
across the WHOLE session, invisibly, at bounded cost — by fixing the five coupled
levers together (supersedes 0XEMEE's inert linear-phase plan).

**See:** [spec.md](./spec.md) once authored.
**Parent:** RV9JT4. **Siblings:** 7D8PJP (built extraction), BNGK9W (#568, transport).
**Supersedes:** 0XEMEE (killed — its phase plan was proven inert by quality-review).

## Why — the evidence carried forward (all measured this session)

- **Model (haiku too weak):** head-to-head on the same 25 MB transcript —
  haiku@180 KB → 1 weak finding; haiku@400 KB → 3 mediocre; **sonnet@400 KB → 9
  valid, high-value** (incl. a real stack-frame secret-leak). ~242 s sonnet.
- **Timing (fires too early):** `decideRetroRun` fires at the first Stop with ≥3
  tool-uses = **line 19 of 9,788 (0.2%)**; #567 isn't discovered until 29%, full
  coverage not until ~50%. Fire-once reads only the opening.
- **THE COUPLING (why a single lever is inert):** `buildDigest` keeps the first
  180 KB = the chronological OPENING. So plain re-arm re-reads the same ~8% every
  fire and surfaces nothing new — timing only helps if the digest reads the new
  TAIL. Hence delta windowing, not head re-digest.
- **Cadence (simulated, sim-rearm.ts):** geometric backoff front-loads (last fire
  38%, 62% blind); friction-gating exhausts a low cap by 7% (3,622 friction lines).
  ADDITIVE cadence (no low cap, high backstop) → last fire 91–100%. Delta makes
  each fire cheap regardless.
- **Execution (async is documented):** `async: true` Stop hooks return immediately
  and run in background (600 s) — the documented fix for the current blocking
  `spawnSync`. Detached survival also proven empirically. Residual: container
  reclaim may kill the LAST fire if the user goes idle instantly (bounded — loses
  one delta).
- **Dedupe (title is fragile):** triage matches `searchByTitle` (titles vary
  across fires) and the child falls back to sessionId `'unknown'` — both break
  re-fire dedupe. Use the content signature + forward the session id.
- **Cost:** sonnet × delta fires ≈ ~$0.18–0.54 typical, ~$1.44 on a 25 MB session.

## Work Log

- 2026-06-30T15:03Z Created to supersede 0XEMEE after /figure-it-out settled the
  coherent slice (delta re-arm + sonnet + `async:true` + signature dedupe). 0XEMEE
  and its inert linear-phase scenarios/piece-1 code reverted. Next: spec.md, then
  scenarios for the combined slice.
