---
id: SXSCJQ
slug: remove-loc-review-throttle
type: task
phase: intake
status: in_progress
created: 2026-05-29T20:32:47.138Z
last_modified: 2026-05-29T20:32:47.138Z
---

# Remove the LOC review-prompt throttle in stop-quality

**Goal:** Remove the implement-phase LOC throttle on the quality-review prompt in `stop-quality.ts` — the `shouldFireReview` gate that suppresses the review softBlock unless `locSinceCommit - locAtLastReview > LOC_REVIEW_THRESHOLD` (50) — so the review fires on every implement-phase stop (consistent with all other phases, which already always fire).

**Why:** Surfaced by SW1SE5's `/figure-it-out`: the throttle conflates two cost models. It was added to limit _noisy_ LLM review prompts, but it gates by LOC, which is a poor proxy for "is there something worth reviewing" — a 5-line change can introduce a real bug while a 60-line rename is noise. SW1SE5 already runs its (silent-when-clean) tsc check _before_ the throttle for exactly this reason. **Tradeoff to weigh at pickup (re-validation):** removing it makes the review prompt fire every implement stop — more frequent nudges. Decide whether that's acceptable, or whether a smarter signal (e.g. fire only when edits touched code, or a per-stop dedup) beats both the throttle and blanket-always. Not blindly remove — converge the cadence question first.

## Work Log

- 2026-05-29T20:32:47.138Z Started: Created ticket SXSCJQ
