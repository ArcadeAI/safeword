---
id: 047
type: task
phase: intake
status: wontfix
created: 2026-03-20T15:08:00Z
last_modified: 2026-06-06T02:10:00Z
parent: 044
---

# Smarter Stop Hook Loop Guard

**Goal:** Replace the one-shot `stopHookActive` guard with edit-aware logic so the stop hook re-fires when review triggers new edits.

**Why:** Current guard (`if (stopHookActive) process.exit(0)`) lets Claude stop after one review acknowledgment even if that review prompted code changes. The review's value is lost when new work isn't reviewed.

## Resolution — wontfix (2026-06-06)

**Closed: the premise no longer holds.** Revalidation against the current `stop-quality.ts` plus a fresh read of Claude Code's hooks docs shows both the review architecture and the platform guidance moved past this 2026-03 proposal.

- **The gap is covered elsewhere now.** Reviews no longer fire only at Stop. The PostToolUse review (tickets SXSCJQ / SW1SE5 / AP3FGJ) fires a per-step / per-phase review _at the edit_, autonomous-safe, deduped via `lastReviewedStep` / `lastReviewedPhase`. A review-triggered edit gets reviewed by PostToolUse when it crosses a step/phase boundary; the Stop hook is now an explicit "boundary backstop" (`stop-quality.ts:510-514`), not the primary review trigger.
- **The proposed fix now fights platform guidance.** Claude Code's hooks guide prevents Stop re-fire loops by checking `stop_hook_active` and exiting early; the transcript JSONL schema is undocumented, so parsing it to detect "edits in the most recent message" (this ticket's proposal) is fragile, and an 8-block cap already backstops loops. The one-shot `stop_hook_active` guard at `stop-quality.ts:490` is the sanctioned pattern.
- **Infinite-loop risk.** Edit-aware re-fire would loop on any review that triggers a trivial edit (e.g. a formatter touch), relying on the block cap to break out.

**Accepted residual gap (by design):** a review-triggered edit _within an already-reviewed step_ isn't re-reviewed, because the per-boundary dedup deliberately reviews each step/phase once to avoid churn. Re-reviewing every micro-edit is the exact churn the current architecture removed — fixing it would relitigate a settled tradeoff, and matches this ticket's own "Priority: Low — defense-in-depth" note.

The original proposal below is retained for history.

## Current Behavior

1. Claude edits code → stop → stop hook fires (stopHookActive=false) → blocks with review
2. Claude does review → stop → stop hook fires (stopHookActive=true) → **exits immediately**

If the review triggered edits in step 2, those edits are never reviewed.

## Proposed Fix

Instead of boolean guard, check if new edits happened in the most recent assistant message only:

```typescript
const messagesToCheck = stopHookActive ? 1 : MAX_MESSAGES_FOR_TOOLS;
```

- First stop: check last 5 messages for edits (broad detection)
- Continuation: check only the most recent message (did the review trigger edits?)
- No edits in most recent = review was text-only → allow stop
- Edits in most recent = review triggered fixes → re-block for another review

## Priority

Low — phase access control (046) already prevents the main bypass path (writing code during planning phases). This is defense-in-depth for the implement phase.

## Scope

- `.safeword/hooks/stop-quality.ts` — replace boolean guard with edit-aware check
- `packages/cli/templates/hooks/stop-quality.ts` — sync template
- Tests for both scenarios (review with edits, review without edits)

## Work Log

- 2026-03-20 15:08 UTC — Ticket created from workflow analysis during 043/046 implementation.
- 2026-06-06T02:10:00Z — Revalidated + /figure-it-out → **wontfix**. Premise no longer borne out: PostToolUse per-edit review (SXSCJQ/SW1SE5/AP3FGJ) covers review-triggered edits; Claude Code docs endorse the `stop_hook_active` one-shot guard and discourage transcript-parsing re-fire (undocumented schema, 8-block cap already backstops loops); residual same-step gap accepted by design. See Resolution.
