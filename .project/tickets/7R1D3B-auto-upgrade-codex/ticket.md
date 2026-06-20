---
id: 7R1D3B
slug: auto-upgrade-codex
type: feature
phase: intake
status: blocked
epic: auto-upgrade-cross-agent
parent: BJX7WR
created: 2026-06-20T12:54:31.996Z
last_modified: 2026-06-20T12:54:31.996Z
---

# Auto-upgrade under Codex

**Goal:** Codex users get safeword's seamless patch/minor auto-upgrade (today Claude-Code-only) without manual `safeword upgrade` and within Codex's synchronous hook contract.

**Parent:** [BJX7WR — cross-agent auto-upgrade](../BJX7WR-auto-upgrade-cross-agent/ticket.md)

**Blocked on:** the epic-level /figure-it-out (shared apply-core extraction + the per-agent non-blocking/messaging contract). Don't start implementation until that lands.

## Current state

- `.codex/config.toml` has only `UserPromptSubmit` (prompt-timestamp) + `PreToolUse` (codex/pre-tool-quality). **No SessionStart hook** — `CODEX_SESSION_START_HOOK_PATCH` exists in `schema.ts` but was **removed during P30CRP** (it's in `unpatchContent`).
- Codex hooks are **synchronous** with `timeout` + `statusMessage`; **no exit-code rewake**. Exit 2 = failure after timeout. So no asyncRewake-style messaging, and a slow apply would block + risk the timeout.

## Scope (pending epic design)

- Re-introduce a Codex SessionStart hook (or equivalent) that invokes the **shared apply core**.
- Apply silently within the hook timeout; the git commit is the record (no exit-2 messaging on Codex). Consider `statusMessage` for a "checking/upgrading" hint.
- Because Codex hooks block, the apply must be fast or bounded — it only runs when an upgrade is actually pending (gated by `.update-cache.json` + 24h cooldown), so cost is ≤ once/day; confirm that's acceptable vs. a deferred/background strategy.
- Reuse `.update-cache.json`, cooldown, strike counter, git pre-flight unchanged.
- Mind the Codex config patch mechanism (`schema.ts` textPatches + `unpatchContent`) so setup/upgrade/reset add/remove the hook cleanly. Verify Claude Code behavior untouched; update parity/coverage.

## Open questions

- What `timeout` is safe for a real `bunx safeword upgrade` apply on Codex? Does exceeding it corrupt the session or just skip?
- Should Codex apply run at SessionStart, or move to a less latency-sensitive trigger?

## Work Log

- 2026-06-20T12:54:31.996Z Created (child of BJX7WR). Blocked on epic figure-it-out.
