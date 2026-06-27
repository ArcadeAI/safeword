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

**Outcome:** Investigated and **rejected** the turn-start block. `beforeSubmitPrompt`
is the wrong layer for the phase precondition; the rule lives at the edit layer
(`preToolUse`, shipped by T3DV1K) at exact Claude parity. No `beforeSubmitPrompt`
hook ships.

**Why rejected:** Cursor's `beforeSubmitPrompt` sees only prompt text — no tool
name or file path (docs verified). So it cannot tell "create test-definitions.md"
from "write application code", and a block there is a catch-22: it stops the very
prompt that asks the agent to create the scenarios. (Claude's prompt-time hook can
*inject a reminder* instead of blocking; Cursor's can only hard-block, so the same
idea is unforgiving here.) It also keyed off the globally most-recent `in_progress`
ticket (`getActiveTicket`, mtime), blocking unrelated work — a bug the session-bound
edit gate structurally can't have.

The edit-layer gate (`pre-tool-quality.ts`, spawned by the Cursor `preToolUse`
adapter) is path-aware (`META_PATHS` lets scenario/meta files through, so no
catch-22) and session-bound (keys off `state.activeTicket`, set when the agent
edits a `ticket.md` this session). It matches Claude exactly, including the
documented first-turn gap (no enforcement until a ticket is bound) — left as-is for
parity rather than adding a stricter Cursor-only fallback.

## Done when

- No `beforeSubmitPrompt` hook is wired (removed from generator + schema + dogfood).
- The implement-phase precondition is enforced at `preToolUse` with block / allow /
  meta-exempt / session-bound coverage (`tests/integration/cursor-pretooluse-gate.test.ts`).

## Source

cursor.com/docs/hooks (`beforeSubmitPrompt` input = prompt/attachments only; no
tool/path); `pre-tool-quality.ts` (`META_PATHS` exemption, session-bound gate).

## Work Log

- 2026-05-31 Created from Cursor research — current gates are non-blocking.
- 2026-06-24 Built the `beforeSubmitPrompt` block, then a reviewer caught the
  early-implement deadlock + cross-ticket false-positive. Ran `/figure-it-out`:
  the hook can't see the pending tool/path, so it can never match the Claude edit
  surface, while T3DV1K's `preToolUse` adapter already enforces it correctly.
  Decision: remove the `beforeSubmitPrompt` gate entirely (config + schema + the
  ANAXG4 failClosed flag + the script + dogfood `.cursor/hooks.json`); add the
  edit-gate parity test matrix. Enforcement unchanged; both bugs gone.
