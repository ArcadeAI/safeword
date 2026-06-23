---
id: HMZSCD
slug: let-codex-verify-task-tickets-without-claude-session-proof
type: task
phase: done
status: done
scope:
  - Align `/verify` and `/audit` invocation-log instructions with the actual done-gate policy: feature tickets still require current-session skill proof; task/patch tickets may continue with `verify.md` when session proof is unavailable.
  - Let the invocation helper accept an explicit session id argument so Claude skill surfaces can pass `${CLAUDE_SESSION_ID}` directly instead of relying only on an exported environment variable.
  - Update the done-gate missing-invocation message so it describes missing session-scoped proof generically, instead of blaming only `CLAUDE_SESSION_ID`.
  - Update README permission guidance so it does not claim the entire done gate is inoperable without bash injection for task/patch tickets.
  - Update dogfood and template copies together, preserving schema parity and existing namespace-root behavior.
out_of_scope:
  - Inventing or hard-coding a fake Codex session id such as `codex-session`.
  - Adding a new Codex stop-hook/session bridge.
  - Changing which ticket types require `/verify` and `/audit` skill-invocation proof at the done gate.
  - Fixing `/self-review` review-stamp fallback wording; that is related client-portability work but not session-proof-specific.
done_when:
  - Feature-ticket verify/audit instructions remain fail-closed when no real session id can be logged.
  - Task/patch-ticket verify/audit instructions allow writing `verify.md` with an explicit note when session-scoped proof is unavailable and not required by the gate.
  - `record-skill-invocation.ts` supports an explicit session id argument while retaining the existing `CLAUDE_SESSION_ID` fallback.
  - README and done-gate failure text match the feature-only invocation-proof enforcement.
  - Focused invocation-log and verify/audit surface tests pass.
created: 2026-06-15T22:50:05.640Z
last_modified: 2026-06-21T21:52:00Z
---

# Let Codex verify task tickets without Claude session proof

**Goal:** Let Codex complete task-ticket verification without fabricating Claude session proof or blocking on proof the done gate does not require.

**Why:** The current `/verify` instructions fail closed whenever `CLAUDE_SESSION_ID` is missing, but the actual done gate only requires session-scoped `/verify` and `/audit` invocation proof for feature tickets.

## Figure-It-Out Decision

**Frame:** Decide how safeword should handle `/verify` and `/audit` invocation proof when a client cannot provide Claude's session id in the skill shell context.

**Research domains:** Claude skill dynamic injection and `${CLAUDE_SESSION_ID}` substitution; Claude/Codex hook `session_id` inputs; safeword done-gate spoof resistance; cross-client skill portability.

**Options considered:**

- Keep the current universal fail-closed wording. This preserves feature-ticket safety but wrongly blocks Codex task-ticket verification.
- Use a fixed fallback session id. This unblocks the helper but weakens the proof model and may not match the hook's real `session_id`.
- Align the skill instructions with the done gate and pass explicit session ids where the client supports them.

**Recommend:** Align the instructions with the gate. Feature tickets should still fail closed without a real current-session proof; task and patch tickets may write `verify.md` with a note that session-scoped proof was unavailable and not required. Claude skill surfaces should pass `${CLAUDE_SESSION_ID}` explicitly to the helper.

**Next:** Update `record-skill-invocation.ts`, `/verify`, and `/audit` surfaces, then add focused tests around the fallback wording and explicit session id argument.

## Tests

- [x] RED: Add a helper test proving an explicit session id argument is accepted and written to `skill-invocations.log`.
- [x] RED: Add or update surface-contract tests proving `/verify` and `/audit` distinguish feature-ticket fail-closed behavior from task/patch-ticket no-session fallback guidance.
- [x] RED: Add or update doc/error-message contract coverage for README and the done-gate missing-invocation message.
- [x] GREEN: Implement the helper argument and wording changes.
- [x] REFACTOR: Keep dogfood/template surfaces byte-aligned and avoid adding client-specific branching to the helper beyond session-id resolution.

## Codebase Sweep

**Same problem, in scope:**

- `/verify` and `/audit` copies in `.agents/skills/`, `.claude/skills/`, `.cursor/commands/`, `packages/cli/templates/skills/`, and `packages/cli/templates/commands/` all carry the same universal fail-closed wording.
- `packages/cli/tests/skill-invocation-log.test.ts` currently locks that wording, so the tests must change with the surface text.
- `README.md` says the done gate is currently inoperable without bash injection; that is too broad because task/patch tickets only need `verify.md`.
- `stop-quality.ts` missing-invocation text names `CLAUDE_SESSION_ID` even though the enforcement is really "no current-session proof was logged".

**Related but separate:**

- `/self-review` also assumes Claude-style render-time `!` execution before telling agents to stop if no stamp appears. Its `write-review-stamp.ts` path does not require `CLAUDE_SESSION_ID`, so it should be fixed as a separate review-stamp fallback task.

**Not the same bug:**

- `write-review-stamp.ts` records `unknown-session` when no Claude session id exists, but review-stamp gates parse the content-bound `review:<scope>` token rather than enforcing current-session identity. That is a different trust boundary and should not be folded into the `/verify` session-proof fix.

## Work Log

- 2026-06-21T21:52:00Z Closed: deliverables verified on origin/main (explicit session-id arg in record-skill-invocation.ts, verify/audit task-fallback wording, generic done-gate message, README fix); done_when re-confirmed — focused suites pass (skill-invocation-log, record-skill-invocation, review-stamp). Work shipped 2026-06-16 but the ticket was left in_progress; closing administratively (one of the #294 stale set).
- 2026-06-16T01:29:30Z Follow-up: Updated README permission guidance from stale inline `node -e`/`mkdir -p`/`echo` fragments to the current Bun helper pattern (`Bash(bun */.safeword/hooks/record-skill-invocation.ts*)`) and added README contract coverage. Revalidated focused invocation-log tests, related hook/gate tests, `test:done`, and `git diff --check`. Figure-it-out review chose not to rewrite generated skill commands or auto-install Claude permissions because Claude evaluates compound Bash commands per subcommand and repo-installed permission grants should remain an explicit user/team choice.
- 2026-06-15T23:56:22Z Verified: Focused suite passed (`tests/hooks/record-skill-invocation.test.ts`, `tests/skill-invocation-log.test.ts`, `tests/integration/skill-gate-integration.test.ts`); broader hook/schema suite passed (`test:done`, 457 tests).
- 2026-06-15T23:55:00Z Implemented: `record-skill-invocation.ts` now accepts an explicit session id argument with `CLAUDE_SESSION_ID` fallback; verify/audit templates and dogfood copies pass `${CLAUDE_SESSION_ID}` explicitly and document feature fail-closed vs task/patch/no-ticket fallback behavior; done-gate and README wording now describe missing session-scoped proof generically.
- 2026-06-15T23:50:00Z RED: Added failing coverage for explicit session-id precedence, generic missing-session error, verify/audit surface wording, README guidance, and the feature done-gate failure text.
- 2026-06-15T23:48:26Z Revalidated: `/figure-it-out` against current Claude, Cursor, and Codex docs confirmed the original scope: do not invent a Codex session id or bridge; keep feature-ticket proof fail-closed, but allow task/patch/no-ticket verification to proceed with a `verify.md` note when session-scoped proof is unavailable and not required.
- 2026-06-15T22:55:00Z Swept: Found same-root wording in verify/audit dogfood/template/command copies, README, and the done-gate error message. Found related `/self-review` render-time shell assumption, kept separate because review stamps are content-bound and not session-proof-bound.
- 2026-06-15T22:54:00Z Scoped: Filed from Codex investigation after `B8GCC1` was left `in_progress` solely because `/verify` could not record `CLAUDE_SESSION_ID`; root cause is instruction wording broader than the feature-only done-gate invocation-proof requirement.
- 2026-06-15T22:50:05.640Z Started: Created ticket HMZSCD
