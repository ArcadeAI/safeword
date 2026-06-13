---
id: F2TKR3
slug: cursor-before-submit-prompt-gate
type: task
phase: intake
status: in_progress
epic: cursor-changelog-alignment
relates_to: VAX3Z2
---

# Wire beforeSubmitPrompt as Cursor turn-start blocking gate

**Goal:** Add a `beforeSubmitPrompt` hook — the only true turn-start chokepoint on Cursor that can block — to inject the phase reminder and hard-gate when a phase precondition is unmet.

**Why:** Today safeword leans on `.cursor/rules` for per-prompt steering, which can't enforce. `beforeSubmitPrompt` returns `{ continue: false, user_message }` to actually stop a prompt.

## Done when

- A `beforeSubmitPrompt` hook injects the phase reminder every turn and blocks (`continue:false`) when the active phase's precondition fails.
- Wired in `.cursor/hooks.json` + the CLI generator; dogfood-verified.

## Source

cursor.com/docs/hooks (`beforeSubmitPrompt` I/O)

## Work Log

- 2026-05-31 Created from Cursor research — current gates are non-blocking.
