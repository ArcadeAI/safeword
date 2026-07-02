---
id: GNTCX4
slug: codex-cursor-donephase-gating-unify
parent: JN403D-architecture-drift-nudge-harness-parity
type: task
phase: intake
status: todo
created: 2026-07-02T18:05:00.000Z
last_modified: 2026-07-02T18:05:00.000Z
scope: |
  The Codex and Cursor Stop adapters gate the architecture-drift nudge on
  "done-phase work" with SLIGHTLY DIFFERENT logic — surfaced during the #601×#605
  merge reconciliation (a /refactor scout flagged it, but unifying is a behavior
  change, not a behavior-preserving refactor, so it was ticketed instead of folded
  into the merge):
    - codex `isDonePhaseWork` (templates/hooks/codex/stop.ts:44-51): reads the
      session-active ticket; if none, FALLS BACK to `getActiveTicket(dir).phase ===
      'done'` (the on-disk active ticket).
    - cursor `architectureNudgeForDonePhase` (templates/hooks/cursor/stop.ts:65-73):
      reads the session-active ticket; if none, returns null (NO fallback) — so a
      Cursor session with no resolvable session ticket never nudges, even when the
      on-disk active ticket is done-phase.
  Decide the intended behavior and make both adapters agree:
    - Option A: Cursor adopts codex's on-disk fallback (both nudge when the on-disk
      active ticket is done-phase even without a session ticket). More consistent
      cross-harness; slightly more eager on Cursor.
    - Option B: codex drops the fallback to match cursor (session-ticket-only).
      Narrower; may miss done-phase drift when session-ticket resolution fails.
    - Then extract ONE shared helper (e.g. `donePhaseArchitectureNudge(dir,
      runIdentity)` in lib/architecture-document-nudge.ts) both adapters call, so
      the gating can't drift again. Mirror templates ↔ .safeword; parity + the
      codex-stop-nudge / cursor-stop-review suites must stay green.
out_of_scope: |
  - The retro nudge composition in the same adapters (shipped in #601, correct).
  - The Claude Stop path (separate hook; not part of this duplication).
done_when: |
  - A/B decided and recorded; both adapters share one done-phase gating helper with
    identical behavior, proven by a test that exercises the no-session-ticket +
    on-disk-done-phase case on BOTH harnesses.
  - Parity clean; existing codex/cursor Stop suites green; no behavior change beyond
    the deliberate A/B choice.
---

# Unify the codex/cursor done-phase architecture-nudge gating

**Goal:** One shared, tested done-phase gate for the architecture-drift nudge across
the Codex and Cursor Stop adapters — they currently differ in the no-session-ticket
fallback, a latent cross-harness inconsistency.

**Why:** #601×#605 merged both adapters' Stop wiring; a refactor scout found the
gating logic duplicated AND divergent (codex has an on-disk `getActiveTicket`
fallback, cursor doesn't). Unifying is a behavior change (whichever way), so it
needs a decision + a test, not a silent merge-time edit.

## Work Log

- 2026-07-02T18:05Z Created from the #601×#605 merge reconciliation `/refactor` scout.
  Both adapters gate on done-phase; codex falls back to the on-disk active ticket
  when no session ticket resolves, cursor does not. Decide A (cursor gains fallback)
  vs B (codex drops it), then extract one shared helper.
- 2026-07-02T22:14Z DECISION: **Option A** (cursor gains the on-disk fallback; unify
  on codex's behavior) via `/figure-it-out`. Both harnesses resolve a session key
  reliably (Codex Stop `session_id`; Cursor Stop `conversation_id` — latest docs), so
  the fallback is a deliberate coverage-widening, not an identity crutch. Chose A
  because the nudge's costly failure is the false-negative (silently-rotting arch
  doc); the false-positive is narrow (fires only when the generated doc actually
  moved); and A *adds* coverage to cursor rather than *removing* it from the shipped
  codex path. Full implementation plan + test + verification captured in GitHub
  issue #619 (pick-up-cold spec). Ready to implement.
