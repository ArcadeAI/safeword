---
id: RBZR3F
slug: cursor-session-start-hook
type: task
phase: intake
status: in_progress
epic: cursor-changelog-alignment
relates_to: VAX3Z2
---

# Add Cursor sessionStart hook for context injection

**Goal:** Inject SAFEWORD phase/context at session open via `sessionStart`'s `additional_context` + `env`, instead of relying solely on `.cursor/rules`.

**Why:** Parity with the Claude Code SessionStart bootstrap; ensures the workflow context is present from turn one.

## Done when

- A `sessionStart` hook emits `additional_context` (and any needed `env`) carrying safeword phase/state.
- Wired in `.cursor/hooks.json` + generator; verified in a fresh Cursor session.

## Source

cursor.com/docs/hooks (`sessionStart`: `additional_context`, `env`, `composer_mode`, `is_background_agent`)

## Work Log

- 2026-05-31 Created from Cursor research.
