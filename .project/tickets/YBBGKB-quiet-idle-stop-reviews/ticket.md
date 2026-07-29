---
id: YBBGKB
slug: quiet-idle-stop-reviews
type: task
phase: verify
status: in_progress
created: 2026-07-29T17:27:17.421Z
last_modified: 2026-07-29T17:57:00.000Z
---

# Keep stop reviews quiet until a new user prompt

**Goal:** Prevent stale stop-quality continuations from forcing idle replies before the next real user prompt.

**Why:** Stop-hook feedback must not create noisy assistant turns while preserving quality review for real edited work.

**External issue:** https://github.com/ArcadeAI/safeword/issues/1492

## Scope

- Remember that the generic Stop quality review has already been surfaced for a session.
- Clear that reminder at the next `UserPromptSubmit` boundary.
- Keep the existing fail-closed review when a transcript has no recoverable human-prompt boundary and no prior review was surfaced.
- Apply the reminder only to the no-ticket generic-review branch, leaving typecheck advice and phase-boundary reviews independent.
- Initialize the session state when that generic review is first surfaced.

## Out of scope

- Changing Claude's `stop_hook_active` behavior or the hard artifact/done gates.
- Suppressing review after a new user prompt or on another session.
- Extending this Claude-only marker to Cursor or Codex: Cursor limits its Stop loop structurally and Codex uses a separate growth-offset guard.

## Figure-it-out decision

The current `stop_hook_active` guard prevents a continuation loop only when the host sets that field. The generic stop-review path can still fall back to earlier edit tools when a host invokes Stop without a new human prompt and without that flag. That is the idle reply in #1492.

Considered options:

1. Treat every missing prompt boundary as no edited work. This is simple, but weakens the deliberate fail-closed behavior for malformed transcripts.
2. Depend only on `stop_hook_active`. This is already implemented and does not cover the reported false-valued idle invocation.
3. Persist a session-scoped "review surfaced; await user prompt" marker. The next prompt clears it; an otherwise idle Stop exits silently. The first malformed transcript remains conservatively reviewed.

Decision: implement option 3. It is narrowly scoped to an already-surfaced generic review, preserves hard gates and malformed-transcript protection, and resets at Claude's documented `UserPromptSubmit` lifecycle boundary.

Pre-mortem: a state-file write failure could still allow a duplicate generic review. The write is best-effort by design, but it now creates the missing session state in the normal case and is located after independent quality gates, so it cannot bypass typecheck, phase, or done verification; tests prove the first generic review persists from an empty session.

## Work Log

- 2026-07-29T17:27:17.421Z Started: Created ticket YBBGKB
- 2026-07-29T17:31:00.000Z Revalidated #1492 against current Stop logic and Claude hook behavior; it remains relevant.
- 2026-07-29T17:31:00.000Z Applied /figure-it-out: chose a per-session post-review marker over weakening the malformed-transcript fallback.
- 2026-07-29T17:31:00.000Z Defined task stories, test definitions, and implementation plan; beginning RED.
- 2026-07-29T17:39:00.000Z RED: Stop hook regression failed because no marker was persisted; prompt-hook regression failed because the marker was not cleared.
- 2026-07-29T17:39:00.000Z GREEN: persisted the marker after generic review, cleared it at UserPromptSubmit, and proved the done gate remains active.
- 2026-07-29T17:39:00.000Z REFACTOR: retained existing state-file conventions and avoided new helpers; focused regression suites pass.
- 2026-07-29T17:42:00.000Z Quality review approved: current Claude hook lifecycle validates the UserPromptSubmit/Stop boundary; installed-hook wiring tests cover both transitions.
- 2026-07-29T17:48:00.000Z Full quality-review/refactor pass: added a two-entry, dependency-ordered ledger for complete re-arm coverage and a clarity-only state-writer rename.
- 2026-07-29T17:57:00.000Z Resolved every quality-review suggestion: added installed-hook re-arm coverage and renamed the combined Stop-review state writer. Package-local regression suite passes 17/17; canonical suite remains queued behind the shared lock.
- 2026-07-29T22:30:00.000Z Reviewed all PR #1652 feedback with /quality-review and /figure-it-out. Moved generic suppression beside the generic branch, initialized fresh state, batched prompt writes, and moved marker-lifecycle coverage to its own installed-hook test file. New focused regressions pass locally; the attempted old-head Node 24 rerun was canceled when the corrected head superseded it, so that fresh CI run is authoritative.
