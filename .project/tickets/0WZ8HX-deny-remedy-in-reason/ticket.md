---
id: 0WZ8HX
slug: deny-remedy-in-reason
type: task
phase: implement
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/5760
scope:
  - deny() in templates/hooks/pre-tool-quality.ts appends the remedy to permissionDecisionReason (reason, remedy, /explain hint) and stops emitting additionalContext, so the remedy reaches Claude once and reaches Cursor, Codex and OpenCode at all.
  - Rewrite the most-reported block (Bash write to ticket.md/spec.md, ~30 retros) in plain language, naming both the Edit/Write tool and apply_patch.
out_of_scope:
  - Stating each gate's rules up front at scaffold or skill time.
  - Reporting every failing prerequisite at once instead of the first.
  - Adapter-level tool-name rewriting for Codex.
  - Rewording the other 44 deny messages.
  - Other hooks' denies (pre-tool-dependency-readiness already carries its remedy in the reason).
done_when:
  - Every pre-tool-quality deny that has a remedy puts it in permissionDecisionReason, ahead of the /explain hint, and emits no additionalContext.
  - The Cursor adapter's agent_message for such a deny contains the remedy.
  - The Bash ticket-write block reads in plain language with no internal terms (activation artifact, downgrade) and names the allowed tools.
  - Updated quality-gates tests and the full hook suites pass; generated surfaces are regenerated and check clean.
created: 2026-10-11T15:43:15.735Z
last_modified: 2026-10-11T15:43:15.735Z
---

# Put each block's fix in the block reason so every host agent sees it

**Goal:** Every Safeword PreToolUse block carries its remedy in permissionDecisionReason, the one field Claude, Cursor, Codex and OpenCode all deliver

**Why:** Cursor and OpenCode drop additionalContext, so agents there never see how to clear a block (#5760, 167 friction retros)

**Type:** Bug

**Design:** `/figure-it-out` (2026-10-11) chose to merge the remedy in `deny()` over patching each host
adapter. The reason field is the only one all four hosts deliver: Claude shows it on deny, Cursor's
`claudeDenialReason` and OpenCode's exit-code mode keep only it, and Codex's handling of
`additionalContext` on a deny is unconfirmed. The split dates from `9511e98a0` (Mar 2026), which used
`additionalContext` for skill pointers; nothing relies on the separation.

**Tests:**

- [x] A deny with a remedy (test-definitions.md created before ticket.md) carries the remedy text
      (`apply_patch`, `ordered patches`) in `permissionDecisionReason`, before the `/explain` hint, and
      emits no `additionalContext`.
- [x] A deny without a remedy (LOC gate) still emits no `additionalContext`.
- [x] The Cursor gate adapter turns a remedy-bearing deny into an `agent_message` containing the remedy.
- [x] A Bash append to a ticket.md is denied with a plain-language reason that names the Edit/Write tool
      and `apply_patch` and contains neither "activation artifact" nor "downgrade".

## Work Log

- 2026-10-11T15:43:15.735Z Started: Created ticket 0WZ8HX
- 2026-10-11T15:44:10.927Z Phase: intake → implement
