---
id: Y6HZR7
slug: auto-upgrade-cursor
type: feature
phase: intake
status: blocked
epic: auto-upgrade-cross-agent
parent: BJX7WR
created: 2026-06-20T12:54:31.933Z
last_modified: 2026-06-20T12:54:31.933Z
---

# Auto-upgrade under Cursor

**Goal:** Cursor users get safeword's seamless patch/minor auto-upgrade (today Claude-Code-only) without manual `safeword upgrade` and without breaking Cursor's session start.

**Parent:** [BJX7WR — cross-agent auto-upgrade](../BJX7WR-auto-upgrade-cross-agent/ticket.md)

**Blocked on:** the epic-level /figure-it-out (shared apply-core extraction + the per-agent non-blocking/messaging contract). Don't start implementation until that lands.

## Current state

- `CURSOR_HOOKS.sessionStart` (`packages/cli/src/templates/config.ts`) runs only `session-safeword-context.ts --agent=cursor`. No auto-upgrade.
- Cursor `.cursor/hooks.json` hook format is `{command}` only — **no async/background, no exit-code rewake**. So the Claude Code `asyncRewake`/exit-2 message channel does not exist, and **exit 2 is a blocking hook error** — wiring the existing hook as-is would stall/error session start.

## Scope (pending epic design)

- Wire a Cursor sessionStart entry that invokes the **shared apply core** (extracted in the epic's slice 0).
- Apply silently: do the upgrade + commit-only-safeword-files; the git commit is the record (no exit-2 messaging on Cursor).
- Confirm whether Cursor can run the hook non-blocking; if not, decide whether a bounded one-time apply (fires ≤ once/day, only when an upgrade is pending) is acceptable.
- Reuse `.update-cache.json`, the 24h cooldown, strike counter, and git-state pre-flight unchanged (agent-agnostic).
- Verify Claude Code behavior is untouched; update parity/coverage.

## Open questions

- Does Cursor surface any hook output to the user at session start (for a "major available" hint), or is silent-with-git-record the only option?
- Cursor hook exit-code semantics — confirm exit 0 is the only safe code.

## Work Log

- 2026-06-20T12:54:31.933Z Created (child of BJX7WR). Blocked on epic figure-it-out.
