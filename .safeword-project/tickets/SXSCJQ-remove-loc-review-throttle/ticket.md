---
id: SXSCJQ
slug: remove-loc-review-throttle
type: feature
phase: verify
status: in_progress
created: 2026-05-29T20:32:47.138Z
last_modified: 2026-05-30T04:25:00.000Z
scope:
  - Remove the implement-phase LOC throttle in `stop-quality.ts` (the `shouldFireReview` gate, `LOC_REVIEW_THRESHOLD`, and `locAtLastReview` review-gating) so quality-review cadence is boundary-driven, not LOC-driven.
  - Per-TDD-step reviews — a PostToolUse hook detects each `[ ]→[x]` RED/GREEN/REFACTOR flip in test-definitions.md (reusing `collectNewTransitions`) and surfaces the step-appropriate `getQualityMessage('implement', step)` via `hookSpecificOutput.additionalContext`. Fires live at the flip, so it works in autonomous runs where Stop never fires.
  - Per-BDD-phase reviews — a PostToolUse hook detects each `phase:` change in ticket.md and surfaces `getQualityMessage(newPhase)` via `additionalContext`. Also autonomous-safe.
  - Stop backstop — the de-throttled Stop review fires a step/phase review ONLY for a boundary not already marked this session (dedup), via the existing soft `decision:block`. Covers boundaries crossed by a non-edit path (e.g. a phase bumped by `safeword check`) and ordinary interactive stops.
  - Dedup state — add `lastReviewedStep?` + `lastReviewedPhase?` to `QualityState`; both the PostToolUse hook and the Stop hook read/write them so each boundary is reviewed exactly once across the two triggers.
  - Sync template ↔ dogfood copies; register any new hook/lib in `schema.ts` and `.claude/settings.json`.
out_of_scope:
  - Hard-blocking on a review — every review surface stays soft (additionalContext, or the bypassable Stop `decision:block`). The done gate stays the only hard backstop.
  - The LOC *commit* gate (pre-tool blast-radius `gate: 'loc'`) — untouched. This ticket removes only the review-prompt throttle, not the commit gate.
  - New review CONTENT — reuse existing `getQualityMessage` / `PHASE_EVIDENCE` / `TDD_STEP_EVIDENCE` verbatim.
  - Reviewing mid-step turns (pure work that crosses no boundary) — no review fires; cadence is boundary-only by design.
  - Every-turn phase coaching (re-firing the current-phase checklist each stop) — rejected in favor of once-per-boundary.
  - Bootstrapping `personas.md` / authoring a product JTBD — internal dev-tooling (JTBD skipped via the Y2HCNJ valve; see spec.md).
done_when:
  - A single turn that flips RED then GREEN then REFACTOR surfaces three distinct step reviews (one per flip), not just the last-derived step.
  - A phase transition surfaces exactly one phase review even when the Stop hook never fires (PostToolUse path proven in isolation).
  - The same boundary is never reviewed twice across PostToolUse + Stop (dedup via `lastReviewedStep` / `lastReviewedPhase`).
  - Implement-phase reviews no longer depend on LOC delta — a 5-line change at a step boundary still triggers its review.
  - Unit tests for flip→step-message, phase-change→phase-message, and dedup; integration tests for the PostToolUse and Stop branches; full suite + lint green; templates synced.
---

# Per-step / per-phase quality reviews (retire the LOC review throttle)

**Goal:** Make the quality review fire at every TDD-step boundary (RED/GREEN/REFACTOR) and every BDD-phase boundary, driven by PostToolUse edit-detection (autonomous-safe) with the Stop hook as a deduped backstop — and retire the implement-phase LOC throttle that currently suppresses the review under 50 LOC.

**Why:** Surfaced by SW1SE5's `/figure-it-out`: the throttle gates by LOC, a poor proxy for "is there something worth reviewing" — a 5-line change can introduce a real bug while a 60-line rename is noise. But simply removing it (the original task framing) leaves a deeper gap: Stop fires once per turn with the final state, so a turn that flips RED→GREEN→REFACTOR only ever reviews the last step, and a **long autonomous run never hits Stop at all** — so phase/step reviews silently vanish exactly when unattended. Moving the trigger to PostToolUse (fires at the edit, not at stop) closes both gaps; Stop becomes a deduped backstop for non-edit boundary changes. Reviews stay soft (additionalContext / bypassable block) — the done gate remains the only hard wall.

## Decomposition

**Hook home:** extend `post-tool-quality.ts` (already on `Edit|Write|MultiEdit|NotebookEdit|Bash`, already parses ticket.md, already writes session state) — zero new spawn, zero settings change.

**Phase semantics:** enter-semantics (review the phase now current). Forced by the "Stop must participate" requirement — Stop can't see the exited phase, only the current one, so exit-semantics would leave the Stop trigger unable to fire. Intake/done covered by their hard gates.

**Detection:** per-step = edge-triggered via `collectNewTransitions` (extracted to a shared lib); per-phase = edge-triggered phase-line diff at PostToolUse + level-triggered (`currentPhase != lastReviewedPhase`) Stop backstop. Markers `lastReviewedStep`/`lastReviewedPhase` dedup across both triggers.

| Task                                                                                    | Scenarios                            | Layer       | Builds on |
| --------------------------------------------------------------------------------------- | ------------------------------------ | ----------- | --------- |
| 1. `lib/review-trigger.ts` (step selection, phase enter-review, dedup)                  | S1.1–1.5, S2.1–2.2, S3.1, S3.3, S4.1 | unit        | —         |
| 2. `lastReviewedStep?`/`lastReviewedPhase?` on QualityState                             | infra                                | —           | —         |
| 3. Wire `post-tool-quality.ts` → emit `additionalContext`, update markers               | S1.6, S2.1                           | integration | 1,2       |
| 4. `stop-quality.ts` — delete LOC throttle; level-triggered backstop → `decision:block` | S3.1, S3.2, S4.1                     | integration | 1,2       |
| 5. Sync templates, register lib in schema.ts, full suite + lint                         | all                                  | —           | 3,4       |

## Work Log

- 2026-05-29T20:32:47.138Z Started: Created ticket SXSCJQ
- 2026-05-29T22:58:00.000Z Re-scoped task→feature: per-step + per-phase reviews via PostToolUse (autonomous-safe) + deduped Stop backstop; kill LOC throttle. Scope converged interactively (steelman flipped surface to additionalContext; user added "both triggers" for the autonomous-run gap). JTBD skipped (internal tooling, no personas.md). Phase 0-2 → define-behavior.
- 2026-05-30T04:25:00.000Z Complete: Phase 3 — 12 scenarios across 4 rules (per-step PostToolUse, per-phase PostToolUse, dedup, LOC-throttle-removed). dimensions.md + test-definitions.md saved. S1.5 (batched flips → most-advanced step) resolved via figure-it-out.
- 2026-05-30T04:25:00.000Z Complete: Phase 4 — AODI pass on all 12; adversarial pass surfaced 3 impl notes (Write-path phase detection, re-edit no-double, Stop loop-guard coexistence), no new scenarios. → decomposition.
- 2026-05-30T04:26:00.000Z Complete: Phase 5 — 5 tasks. Hook home = extend post-tool-quality.ts (zero new spawn). Phase review = enter-semantics (forced by Stop-must-participate constraint). → implement.
- 2026-05-30T04:55:00.000Z Complete: Phase 6 — TDD. Extracted checkbox-transitions lib; review-trigger policy (RED 686efc59 → GREEN e0a21927); PostToolUse per-step/per-phase wiring (3d1b2b77); Stop backstop + LOC-throttle removal (1a3725de). 12 scenarios marked. Unit + 2 integration suites green. → verify.
