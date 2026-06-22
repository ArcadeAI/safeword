---
id: K2ZP40
slug: let-codex-earn-self-review-stamps-without-render-time-shell
type: task
phase: done
status: done
scope:
  - Add explicit manual fallback guidance to `/self-review` surfaces when Claude-style render-time `!` execution does not run.
  - Clarify that `write-review-stamp.ts` can earn the content-bound review stamp without `CLAUDE_SESSION_ID`.
  - Update dogfood and template copies together across `.agents/skills/self-review`, `.claude/skills/self-review`, `.cursor/commands/self-review`, `packages/cli/templates/skills/self-review`, and `packages/cli/templates/commands/self-review`.
out_of_scope:
  - Changing review-stamp gate semantics or making review stamps session-scoped.
  - Changing `/verify` or `/audit` invocation-proof behavior; that belongs to `HMZSCD`.
  - Adding a Codex hook bridge for automatic stamp writing.
done_when:
  - Codex/Cursor agents have a documented command to run when no `[skill-invocation-log] ... ✓` stamp appears automatically.
  - Claude Code render-time execution remains supported.
  - Surface-contract tests cover the manual fallback wording.
  - Existing review-stamp helper and gate tests continue to pass.
created: 2026-06-15T22:53:45.782Z
last_modified: 2026-06-21T21:52:00Z
---

# Let Codex earn self-review stamps without render-time shell

**Goal:** Let Codex and Cursor complete `/self-review` by running the review-stamp helper manually when the client does not execute Claude-style `!` lines.

**Why:** `/self-review` currently says the `!` line writes the stamp at render time and then tells the agent to stop if no checkmark appears, but Codex skills do not document or expose Claude-style render-time shell execution.

## Context

This was found during the `HMZSCD` codebase sweep. It is related to the same portability class, but it is not the same session-proof bug:

- `/verify` and `/audit` need current-session invocation proof only for feature done gates.
- `/self-review` needs a content-bound `review:<scope>` stamp for the review gate.
- `write-review-stamp.ts` intentionally falls back to `unknown-session` because review gates parse the review token and content hash, not the session id.

## Tests

- [x] RED: Add or update a self-review surface-contract test proving the manual fallback command is documented.
- [x] GREEN: Update all dogfood/template self-review copies.
- [x] REFACTOR: Keep the wording compact and avoid implying review stamps are session-proof evidence.

## Work Log

- 2026-06-21T21:52:00Z Closed: self-review manual write-review-stamp.ts fallback verified on origin/main, byte-aligned dogfood+template; review-stamp helper/gate tests pass. Shipped 2026-06-16 but the ticket was left in_progress; closing administratively (one of the #294 stale set).
- 2026-06-15T23:56:22Z Verified: Focused surface suite passed and `tests/integration/review-stamp.test.ts` passed, confirming stamp helper semantics still work unchanged.
- 2026-06-15T23:55:00Z Implemented: `/self-review` templates and dogfood copies now include an explicit `write-review-stamp.ts spec` fallback for clients that do not execute Claude-style render-time `!` lines, and clarify the stamp is content-bound rather than `CLAUDE_SESSION_ID` proof.
- 2026-06-15T23:50:00Z RED: Added failing surface-contract coverage across template and dogfood self-review command/skill copies.
- 2026-06-15T23:48:26Z Revalidated: `/figure-it-out` against current Claude, Cursor, and Codex docs confirmed this is a documentation/surface fallback fix, not a review-stamp gate change or new Codex hook bridge.
- 2026-06-15T22:56:00Z Scoped: Filed from the `HMZSCD` sweep. `/self-review` has the same Claude-render-time-shell portability assumption, but uses `write-review-stamp.ts` and content-bound review stamps rather than `CLAUDE_SESSION_ID` proof.
- 2026-06-15T22:53:45.782Z Started: Created ticket K2ZP40
