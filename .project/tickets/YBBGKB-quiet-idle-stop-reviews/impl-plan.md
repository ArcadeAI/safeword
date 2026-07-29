# Implementation Plan — Keep stop reviews quiet until a new user prompt

1. Add an optional, session-scoped quality-state flag recording that the generic Stop review was surfaced and is awaiting a user prompt.
2. Write that flag immediately before the generic review soft-block; do not write it for hard gates, typecheck advice, phase-navigation blocks, or `stop_hook_active` continuations.
3. Clear the flag in the existing `UserPromptSubmit` hook before it derives prompt reminders.
4. Prove the three regression scenarios with focused integration tests, then run lint, the affected package suite, and Safeword verification/review.

The plan intentionally does not change the bounded edit-tool fallback. That fallback is the existing protection for transcript formats where the human boundary cannot be recovered.
