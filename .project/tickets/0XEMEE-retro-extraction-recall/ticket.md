---
id: 0XEMEE
slug: retro-extraction-recall
type: feature
phase: intake
status: in_progress
parent: RV9JT4-retro-transcript-mining
scope: |
  Fix retro's automated extraction recall. A head-to-head eval (this session)
  found the headless extractor caught 0 of the 5 findings a manual in-session
  review caught — two independent failure modes, both must be addressed:

  A. DIGEST HEAD-TRUNCATION (deterministic, packages/cli/templates/hooks/lib/
     retro-extract.ts → buildDigest). The digest is built then `digest.slice(0,
     cap)` keeps only the FIRST `cap` (180 KB) chars. On this 25 MB session the
     uncapped digest was 2.2 MB, so the cap kept 8.1% — and because it's the
     HEAD, everything discovered later in the session is structurally invisible.
     Fix direction: friction-prioritized selection across the WHOLE transcript
     (rank/keep FRICTION-signal lines first; sample head+tail; or chunk-and-map),
     not a head slice.
  B. WITHIN-WINDOW RECALL (model/prompt). Even for the 3/5 findings whose signal
     WAS inside the 180 KB window, haiku extracted none — it returned 1 unrelated
     generic finding. Fix direction: stronger extraction model and/or a few-shot
     prompt with positive/negative examples; evaluate recall on this labeled set.
out_of_scope: |
  - Transport (BNGK9W / #568) — separate; transport is moot if extraction finds
    nothing. This ticket is recall; BNGK9W is delivery.
  - Robust dedup against existing issues — separate concern (was queued as
    "1FGE1C" but never actually filed; re-scope if still wanted).
  - Cost-bounding / friction-gated firing (#563) — separate.
done_when: |
  - On the labeled eval set below (this session's transcript -> findings
    #564-#568), the extractor's recall is materially better than the current
    0/5 — target >= 3/5, measured by a repeatable eval harness (not a one-off).
  - buildDigest no longer drops the tail of a long session: a unit test proves a
    friction signal near the END of an oversized transcript survives into the
    capped digest.
  - An eval harness exists (fixture transcript + expected finding signatures +
    a recall assertion) so future prompt/model/digest changes are regression-
    guarded. Scenarios green; /verify + /audit pass.
created: 2026-06-30T06:15:02.222Z
last_modified: 2026-06-30T06:15:02.222Z
---

# Retro extraction recall is near-zero on long sessions

**Goal:** Make the automated retro extractor actually find the friction a human
review finds — today it finds almost none of it on a real long session.

**See:** [spec.md](./spec.md) once authored.
**Parent:** RV9JT4. **Siblings:** 7D8PJP (built extraction), BNGK9W (#568, transport).

## The eval that motivated this (run live, this session)

Head-to-head: the 5 findings a manual in-session review filed (#564-#568) vs what
the real headless extractor (`buildDigest` -> `claude -p --model haiku` with the
shipped `EXTRACT_SYSTEM_PROMPT`) returned on the **same** 25 MB transcript.

**Extractor returned 1 finding — "Hooks silently swallow their own crashes" —
which is NOT any of the 5. Recall vs the manual set: 0/5.**

Why, measured:

| Manual finding | signal first appears at (digest char) | in 180 KB window? | caught? |
| --- | --- | --- | --- |
| #564 multiple in_progress | 54,308 | yes (in window) | no |
| #565 dependency-readiness | 72,996 | yes (in window) | no |
| #566 arch-doc merge conflict | 122,955 | yes (in window) | no |
| #568 cloud 401 transport | 192,514 | no (CUT OFF) | no |
| #567 retro no dry-run | 976,366 | no (CUT OFF) | no |

- Raw transcript: 24,999,232 bytes. Uncapped digest: 2,225,297 chars. Cap:
  180,000 -> **8.1% kept, and it's the HEAD** (`digest.slice(0, cap)`).
- **Failure A (truncation):** 2/5 signals are past the cap -> invisible by
  construction. Any long session loses its tail.
- **Failure B (recall):** 3/5 signals were inside the window and were still
  missed; haiku produced one unrelated finding instead.

Takeaway: the invisible-retro pipeline (7D8PJP) and the transport fix (BNGK9W)
are both necessary but **not sufficient** — without this, the feature files ~0
of the real findings. This is the self-reporting epic's actual weak link, exactly
as the `natural-vs-self-report-gates.md` learning predicted.

## Work Log

- 2026-06-30T06:15Z Created from a live head-to-head eval (0/5 recall). Two
  failure modes isolated with hard numbers (truncation + within-window recall).
  Eval method + labeled set captured above for the harness. Next: spec.md, then
  decide digest strategy (figure-it-out) before scenarios.
