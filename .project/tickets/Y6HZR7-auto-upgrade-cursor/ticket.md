---
id: Y6HZR7
slug: auto-upgrade-cursor
type: feature
phase: intake
status: blocked
epic: auto-upgrade-cross-agent
parent: BJX7WR
relates_to: VAX3Z2
created: 2026-06-20T12:54:31.933Z
last_modified: 2026-06-25T06:00:00Z
---

# Auto-upgrade under Cursor

**Goal:** Cursor users get safeword's seamless patch/minor auto-upgrade (today Claude-Code-only) without manual `safeword upgrade` and without breaking Cursor's session start.

**Parent:** [BJX7WR — cross-agent auto-upgrade](../BJX7WR-auto-upgrade-cross-agent/ticket.md)

**Blocked on:** BJX7WR slice 0 landing — PR #433 or an equivalent shared-core extraction. The Cursor contract is now decided: silent `sessionStart` wrapper, exit `0`, git commit as record.

## Current state

- `CURSOR_HOOKS.sessionStart` (`packages/cli/src/templates/config.ts`) runs only `session-safeword-context.ts --agent=cursor`. No auto-upgrade.
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

## Scope (pending epic design)

- Wire a Cursor sessionStart entry that invokes the **shared apply core** (extracted in the epic's slice 0).
- Apply silently: do the upgrade + commit-only-safeword-files; the git commit is the record (no exit-2 messaging on Cursor).
- Confirm whether Cursor can run the hook non-blocking; if not, decide whether a bounded one-time apply (fires ≤ once/day, only when an upgrade is pending) is acceptable.
- Reuse `.update-cache.json`, the 24h cooldown, strike counter, and git-state pre-flight unchanged (agent-agnostic).
- Verify Claude Code behavior is untouched; update parity/coverage.

## Open questions

- Deferred: richer Cursor notification UX for major-available / repeated-failure outcomes after silent apply ships.

## Work Log

- 2026-06-20T12:54:31.933Z Created (child of BJX7WR). Blocked on epic figure-it-out.
- 2026-06-25T05:50:00Z Revalidated under Cursor after `/figure-it-out`. Current Cursor hooks docs confirm `sessionStart` is fire-and-forget, `continue:false` / `user_message` are not enforced for session creation, exit `2` is a block path rather than a rewake message, and `failClosed` is for blocking hook failure policy only. Parent BJX7WR slice 0 is still missing: no shared apply core exists yet, so Y6HZR7 remains blocked. No implementation started.
- 2026-06-25T05:55:00Z Parent design updated: Cursor should use a silent `sessionStart` wrapper around the shared apply core, exit `0`, and rely on the git auto-upgrade commit as the durable record. Remaining blocker is implementation slice 0: extract the shared apply core before wiring Cursor.
- 2026-06-25T06:00:00Z Checked PR #433. It does not conflict with this ticket file, and it likely supplies the shared core this ticket needs. If #433 lands first, Y6HZR7 should proceed directly to a Cursor wrapper around `hooks/lib/auto-upgrade.ts`.
