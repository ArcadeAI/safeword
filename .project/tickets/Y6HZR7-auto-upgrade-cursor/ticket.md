---
id: Y6HZR7
slug: auto-upgrade-cursor
type: feature
phase: done
status: done
epic: auto-upgrade-cross-agent
parent: BJX7WR
relates_to: VAX3Z2
scope:
  - Wire Cursor session start to the shared auto-upgrade apply core from BJX7WR.
  - Keep Cursor auto-upgrade silent and fail-open because Cursor sessionStart is fire-and-forget.
  - Preserve user-authored Cursor hooks during setup, upgrade, and reset.
  - Block Cursor write and shell gates while a silent auto-upgrade is mutating safeword-managed files.
out_of_scope:
  - Rich user-visible Cursor notification UX for major-version availability or repeated failure caps.
  - Full migration to `safeword hook <name>` CLI dispatch.
  - Changing Claude Code or Codex auto-upgrade user-facing behavior.
done_when:
  - Cursor setup wires `session-cursor-auto-upgrade.ts` after the SAFEWORD.md context hook.
  - The Cursor wrapper exits 0 without stdout/stderr when no upgrade should apply.
  - Cursor uses the shared auto-upgrade core instead of duplicating apply logic.
  - User-authored Cursor hooks are preserved when safeword hooks are merged or removed.
  - Cursor write and shell gates deny operations while the auto-upgrade lock is active.
created: 2026-06-20T12:54:31.933Z
last_modified: 2026-06-27T01:20:09Z
---

# Auto-upgrade under Cursor

**Goal:** Cursor users get safeword's seamless patch/minor auto-upgrade (today Claude-Code-only) without manual `safeword upgrade` and without breaking Cursor's session start.

**Parent:** [BJX7WR — cross-agent auto-upgrade](../BJX7WR-auto-upgrade-cross-agent/ticket.md)

**Implementation state:** PR #433 landed the shared core. This branch wires Cursor to that core with a silent `sessionStart` wrapper that exits `0`; the auto-upgrade git commit remains the durable record.

## Current state

- `CURSOR_HOOKS.sessionStart` (`packages/cli/src/templates/config.ts`) now runs:
  - `session-safeword-context.ts --agent=cursor` for SAFEWORD.md context
  - `session-cursor-auto-upgrade.ts` for silent auto-upgrade
- Claude Code `SessionStart` wires `session-auto-upgrade.ts` through `asyncRewake`; that script intentionally exits `2` to surface upgraded / major-available / blocked messages back to Claude as a system reminder.
- Cursor hooks do **not** have Claude Code's `asyncRewake` / exit-2 rewake messaging contract. Cursor's command-hook docs say exit `2` blocks the action, and non-zero failures otherwise fail-open unless `failClosed: true`.
- Current Cursor docs say `sessionStart` is **fire-and-forget**: the agent loop does not wait for, block on, or enforce the response. The documented output is only `env` and `additional_context`; docs also say `continue` / `user_message` are accepted by schema but current callers do not enforce them, so session creation is not blocked even when `continue:false`.
- `failClosed` is available for hook failures, but it is not a session-start messaging channel. It belongs on security-critical blocking hooks, not on the Cursor auto-upgrade path.
- Cursor team/plugin distribution can package hooks (`.cursor-plugin/plugin.json` `hooks` field; project/team/enterprise hooks), but distribution does not change `sessionStart` semantics.
- Therefore Cursor auto-upgrade still needs either:
  - a silent apply path where the git commit is the durable record, or
  - a separate user-visible notification strategy that does not depend on `sessionStart` output or exit `2`.

## Revalidation — 2026-06-24

Ran `/figure-it-out` before implementation.

Decision: **still blocked on BJX7WR slice 0 landing**. The parent now chooses the Cursor contract — silent `sessionStart` wrapper, exit `0`, git commit as record. On `main`, the full apply path still lives inside `packages/cli/templates/hooks/session-auto-upgrade.ts`; PR #433 appears to implement the needed shared core in `packages/cli/templates/hooks/lib/auto-upgrade.ts`.

Options considered:

- **Wire Claude's script directly into Cursor `sessionStart`: reject.** Cursor has no `asyncRewake`; exit `2` is a block/error path, not a rewake message.
- **Build a Cursor-specific copy now: reject.** It would duplicate the apply logic the parent explicitly says to share.
- **Update evidence and stay blocked on extraction: choose.** This preserves the parent design constraint and records the current Cursor docs needed for the eventual implementation.

## Scope

- [x] Wire a Cursor sessionStart entry that invokes the shared apply core extracted in PR #433.
- [x] Apply silently: do the upgrade + commit-only-safeword-files; the git commit is the record (no exit-2 messaging on Cursor).
- [x] Keep the hook fail-open for Cursor session start; no `failClosed`, `continue:false`, `user_message`, or exit `2`.
- [x] Reuse `.update-cache.json`, the 24h cooldown, strike counter, git-state pre-flight, and shared apply core unchanged.
- [x] Verify Claude Code behavior is untouched by using a Cursor-only wrapper and focused setup/hook/schema tests.

## Open questions

- Deferred: richer Cursor notification UX for major-available / repeated-failure outcomes after silent apply ships.

## Root Cause

Post-merge `/quality-review` found two risks in the silent Cursor path:

- Cursor `sessionStart` is fire-and-forget, so the auto-upgrade hook can still be
  running when the agent starts editing. The shared core stages safeword-managed
  files after `safeword upgrade`, so Cursor writes need a repository lock while
  the upgrade is active.
- `.cursor/hooks.json` merged Cursor hook arrays by replacing entire safeword
  event arrays. Silent upgrade turns that into a higher-risk path because a user
  could lose custom Cursor hooks without seeing an interactive upgrade step.

Confirmed by inspecting current Cursor docs and the merged code paths in
`session-cursor-auto-upgrade.ts`, `hooks/lib/auto-upgrade.ts`, and
`packages/cli/src/schema.ts`.

## Work Log

- 2026-06-20T12:54:31.933Z Created (child of BJX7WR). Blocked on epic figure-it-out.
- 2026-06-25T05:50:00Z Revalidated under Cursor after `/figure-it-out`. Current Cursor hooks docs confirm `sessionStart` is fire-and-forget, `continue:false` / `user_message` are not enforced for session creation, exit `2` is a block path rather than a rewake message, and `failClosed` is for blocking hook failure policy only. Parent BJX7WR slice 0 is still missing: no shared apply core exists yet, so Y6HZR7 remains blocked. No implementation started.
- 2026-06-25T05:55:00Z Parent design updated: Cursor should use a silent `sessionStart` wrapper around the shared apply core, exit `0`, and rely on the git auto-upgrade commit as the durable record. Remaining blocker is implementation slice 0: extract the shared apply core before wiring Cursor.
- 2026-06-25T06:00:00Z Checked PR #433. It does not conflict with this ticket file, and it likely supplies the shared core this ticket needs. If #433 lands first, Y6HZR7 should proceed directly to a Cursor wrapper around `hooks/lib/auto-upgrade.ts`.
- 2026-06-25T23:45:00Z Implemented Cursor wrapper on `cursor/y6hzr7-cursor-auto-upgrade-wrapper`: added `session-cursor-auto-upgrade.ts`, wired it as a second Cursor `sessionStart` command, registered it in schema/package/hook coverage, and added setup + integration tests. Focused tests green: 127/127.
- 2026-06-26T02:20:00Z Followed up on post-merge quality review: added the missing `impl-plan.md`, preserved user-authored Cursor hook entries during merge/unmerge, dogfooded the new Cursor sessionStart hook, and added a git-dir auto-upgrade lock that makes Cursor write gates wait while silent auto-upgrade runs.
- 2026-06-27T01:20:09Z Closed after PR #447 and PR #463 merged. Backfilled required closeout artifacts (`spec.md`, `dimensions.md`, `test-definitions.md`, `verify.md`, `audit.md`), verified focused Cursor auto-upgrade checks (131/131), lint/typecheck, format, build, and BDD (159/159), and marked the ticket done.
