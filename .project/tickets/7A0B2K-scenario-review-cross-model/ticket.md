---
id: 7A0B2K
slug: scenario-review-cross-model
type: task
phase: implement
status: in_progress
created: 2026-06-12T02:37:21.358Z
last_modified: 2026-06-24T00:46:00.000Z
---

# Wire the phase-exit fork review to the cross-model knob

**Goal:** Let the Tier 2 phase-exit fork review (NMSD94) require a different-model reviewer when `crossModelReview` is on, reusing MR5M3A's `modelsMatch` / `isCrossModelReviewRequired` / `AUTHOR_MODEL_ENV` primitives in `review-ledger.ts`.

**Why:** the phase-exit review is currently same-model, so it shares the author's blind spots (the correlated-error problem MR5M3A documents). MR5M3A fixed this for the design review; this extends the same protection to phase reviews — the review that catches bad scenarios should itself be independent of the author's model when configured. Surfaced 2026-06-12 while dogfooding MR5M3A: the fork review that caught 7 real findings was itself same-model. Realigned by ticket BHK9PW's reviewer-class taxonomy: phase-exit review is class-1, so cross-model is exactly the protection it should carry.

## Scope decision

The NMSD94 phase-exit gate (`pre-tool-quality.ts`) is **already generalized** — it fires on any phase advance (`detectPhaseAdvance` has no phase filter), not just scenario-gate. So rather than special-casing scenario-gate, the cross-model ceiling-raiser was added to the **general** phase-exit gate: it now covers scenario-gate _and_ every other gated phase exit uniformly. This is the consistent class-1 application the taxonomy argues for, and it is less code than a special case. Ticket title/slug kept for traceability; goal reworded.

## What shipped

- `pre-tool-quality.ts`: after the stamp-presence check passes, a cross-model ceiling-raiser (mirroring the arch-gate in `stop-quality.ts`): under `crossModelReview`, real-review stamps at the phase scope must include one whose `model:` tag differs from `SAFEWORD_AUTHOR_MODEL`; else deny. Logged skips bypass (same auditable escape valve). Fails closed when either model tag is absent.
- `isCrossModelOn()` config reader added beside `isReviewGateOn()`.
- Synced template → `.safeword/hooks/` dogfood copy.
- Tests: 6 new cases in `tests/integration/phase-review-gate.test.ts` (equal-model blocks, different-model allows, no-model fails closed, cross-model-OFF allows, skip bypasses, different-model re-review after same-model passes).

## Done when

- Phase-exit gate blocks a same-model (or untagged) review under `crossModelReview`, allows a different-model one, stays inert when the flag is off, and the skip valve still works. ✅
- Full suite green; typecheck clean. ⏳ (full run in progress)

## Work Log

- 2026-06-12T02:37:21.358Z Started: Created ticket 7A0B2K
- 2026-06-24T00:46:00Z Implemented via TDD (RED: 2 failing cross-model cases → GREEN: ceiling-raiser in phase-exit gate). Reused MR5M3A primitives verbatim. Scoped to the general phase-exit gate (covers scenario-gate + all phases) per the taxonomy. 13/13 phase-gate tests pass; 75/75 across phase-gate + arch-gate + review-gate + review-ledger + models-match; typecheck clean. Synced dogfood copy. Full suite running before commit.
