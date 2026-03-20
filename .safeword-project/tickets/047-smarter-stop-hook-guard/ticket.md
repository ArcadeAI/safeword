---
id: 047
type: task
phase: intake
status: pending
created: 2026-03-20T15:08:00Z
last_modified: 2026-03-20T15:08:00Z
parent: 044
---

# Smarter Stop Hook Loop Guard

**Goal:** Replace the one-shot `stopHookActive` guard with edit-aware logic so the stop hook re-fires when review triggers new edits.

**Why:** Current guard (`if (stopHookActive) process.exit(0)`) lets Claude stop after one review acknowledgment even if that review prompted code changes. The review's value is lost when new work isn't reviewed.

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
