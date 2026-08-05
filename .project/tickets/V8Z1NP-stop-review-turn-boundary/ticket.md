---
id: V8Z1NP
slug: stop-review-turn-boundary
type: task
phase: intake
status: in_progress
created: 2026-08-05T15:06:34.162Z
last_modified: 2026-08-05T15:06:34.162Z
---

# Review the long turns that do the most work, instead of silently skipping them

**Goal:** Make the Stop quality review reach turns whose edits happened more than a few tool rounds before the reply — today those turns are skipped entirely.

**Why:** `detectEditToolsUsedInCurrentUserTurn` walks back looking for the turn's user prompt but stops after `MAX_MESSAGES_FOR_TOOLS` (5) assistant messages. Any turn with more tool rounds than that never finds its boundary, so the caller falls back to a turn-blind scan of the same short window — and an edit made earlier in the *same* turn is invisible. The Stop quality review is silently skipped on exactly the largest turns.

**Corrected diagnosis:** this ticket was opened expecting a false *positive* (review firing on turns that did no work, per #1431). Writing the test inverted it: the window bug is a false *negative*. The control case (edit inside the window) reviews correctly; push the edit out with 12 tool rounds and the hook exits silently. Recorded because the original hypothesis shipped into the ticket before the test ran.

**Scope:** `detectEditToolsUsedInCurrentUserTurn` only. The legacy `detectEditToolsUsed` fallback (reached only when no boundary is found within the new line budget) is unchanged.

## Work Log

- 2026-08-05T15:06:34.162Z Started: Created ticket V8Z1NP
- 2026-08-05T15:12:00Z RED: tests/integration/stop-review-long-turn.test.ts — control passes, long-turn case fails (hook silent despite an in-turn edit). Hypothesis inverted vs intake: false negative, not false positive.
- 2026-08-05T15:12:00Z GREEN: boundary walk bounded by transcript lines (MAX_LINES_FOR_TURN_BOUNDARY = 400) instead of assistant-message count. 47/47 in the new file; 209/209 across six stop-hook suites. Template + .safeword mirror kept byte-identical.
