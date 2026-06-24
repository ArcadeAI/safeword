---
id: F2TKR3
slug: cursor-before-submit-prompt-gate
type: task
phase: intake
status: in_progress
epic: cursor-optimization
relates_to: VAX3Z2
---

# Wire beforeSubmitPrompt as Cursor turn-start blocking gate

**Goal:** Add a `beforeSubmitPrompt` hook — the only true turn-start chokepoint on Cursor that can block — to hard-gate when a phase precondition is unmet.

**Why:** Today safeword leans on `.cursor/rules` for per-prompt steering, which can't enforce. `beforeSubmitPrompt` returns `{ continue: false, user_message }` to actually stop a prompt. Cursor's documented contract for this hook provides no context-injection field, so per-turn reminders are out of scope.

## Done when

- A `beforeSubmitPrompt` hook blocks (`continue:false`) with a clear `user_message` when the active ticket's phase precondition fails (e.g., `implement` phase with no `test-definitions.md`).
- Wired in `.cursor/hooks.json` + the CLI generator; dogfood-verified.

## Source

cursor.com/docs/hooks (`beforeSubmitPrompt` I/O)

## Work Log

- 2026-05-31 Created from Cursor research — current gates are non-blocking.
