---
id: AKNWZK
slug: cursor-stop-gate-rearchitect
type: task
phase: intake
status: in_progress
epic: cursor-changelog-alignment
relates_to: VAX3Z2
---

# Re-architect done/stop gate for Cursor (stop cannot block)

**Goal:** Make the done gate behave correctly on Cursor, where `stop` cannot block — it can only auto-continue via `followup_message`, capped by `loop_limit` (default 5).

**Why:** Safeword's done gate assumes a blocking Stop hook (Claude Code). On Cursor that's impossible; the gate silently degrades to nudging. Make that explicit and deliberate.

## Approach

- Move the real enforcement upstream to `beforeSubmitPrompt` (F2TKR3): refuse the *next* turn's progression until `verify.md` exists, rather than trying to block the stop.
- Use `stop` `followup_message` to nudge; set `loop_limit` deliberately (`null` for persistent nudging, or a number to cap).
- Document the Cursor-vs-Claude-Code divergence in the integration notes.

## Done when

- Done-gate behavior on Cursor is defined and implemented (upstream block + nudge), with `loop_limit` set intentionally and the divergence documented.

## Source

cursor.com/docs/hooks (`stop` non-blocking, `loop_limit` default 5 / null)

## Work Log

- 2026-05-31 Created from Cursor research — `stop` is observe-only.
