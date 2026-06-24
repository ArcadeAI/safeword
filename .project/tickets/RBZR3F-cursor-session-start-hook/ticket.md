---
id: RBZR3F
slug: cursor-session-start-hook
type: task
phase: intake
status: done
epic: cursor-changelog-alignment
relates_to: VAX3Z2
last_modified: 2026-06-24T04:30:00Z
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
- 2026-06-24 — **Closed as done.** Revalidation against live code: `.cursor/hooks.json` wires `sessionStart` → `bun ./.safeword/hooks/session-safeword-context.ts --agent=cursor`, and that hook emits `{ additional_context }` on the `cursor` branch (`session-safeword-context.ts:78`). The generator carries it too (`CURSOR_HOOKS.sessionStart` in `packages/cli/src/templates/config.ts`). Both done-when items met (emits `additional_context`; wired in `.cursor/hooks.json` + generator). `env`/`composer_mode` were optional ("any needed") and not required for the phase/state payload — not a gap.
