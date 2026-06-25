---
id: 7R1D3B
slug: auto-upgrade-codex
type: feature
phase: verify
status: in_progress
epic: auto-upgrade-cross-agent
parent: BJX7WR
external: https://github.com/ArcadeAI/safeword/issues/393
scope:
  - Extract the Claude auto-upgrade apply path into a shared typed core.
  - Replace Codex's direct SessionStart context hook with a single dispatcher that runs auto-upgrade first, then emits SAFEWORD.md context.
  - Map shared outcomes to each agent contract: Claude keeps asyncRewake exit-2 notices; Codex emits successful SessionStart JSON for normal notices.
  - Roll back safeword-managed file changes when an attempted apply or commit fails.
  - Update schema/template wiring and focused tests for setup, hook behavior, and rollback.
out_of_scope:
  - Full `safeword hook <name>` CLI migration from D6GTXY.
  - Detached/background Codex auto-upgrade workers.
  - Enterprise managed hook requirements or plugin marketplace packaging.
  - Real-world Codex timeout tuning beyond a conservative dispatcher timeout.
done_when:
  - Fresh and retrofitted Codex configs contain exactly one safeword SessionStart command for `session-codex-start.ts`.
  - Codex SessionStart still emits SAFEWORD.md additional context after the upgrade check.
  - Claude auto-upgrade user-facing behavior is unchanged for major-version and applied-upgrade notices.
  - Failed applies roll back safeword-managed tracked and untracked changes before recording a failure strike.
  - Targeted hook/schema/reconcile tests pass.
created: 2026-06-20T12:54:31.996Z
last_modified: 2026-06-25T04:46:17Z
---

# Auto-upgrade under Codex

**Goal:** Codex users get safeword's seamless patch/minor auto-upgrade (today Claude-Code-only) without manual `safeword upgrade` and within Codex's synchronous hook contract.

**Parent:** [BJX7WR — cross-agent auto-upgrade](../BJX7WR-auto-upgrade-cross-agent/ticket.md)

**Unblocked by:** the 2026-06-24 figure-it-out + quality-review passes. The selected design is a shared typed apply core plus per-agent wrappers, with Codex using one synchronous SessionStart dispatcher that sequences auto-upgrade before SAFEWORD.md context injection.

## Current state

- `.codex/config.toml` now has one `SessionStart` hook for SAFEWORD.md context injection plus `UserPromptSubmit` (prompt-timestamp) and `PreToolUse` (codex/pre-tool-quality).
- Codex hooks are **synchronous** with `timeout` + `statusMessage`; **no exit-code rewake**. Exit 2 is a hook failure path, not a user-facing reminder contract.
- Codex runs matching hooks for the same event concurrently, so auto-upgrade must not be wired as a second `SessionStart` command beside context injection. Use one dispatcher that performs upgrade first, then emits context.

## Scope (pending epic design)

- Replace the Codex SessionStart context command with one dispatcher that invokes the **shared apply core** and then emits SAFEWORD.md context.
- Apply silently within the hook timeout; the git commit is the record (no exit-2 messaging on Codex). Use `systemMessage`/`additionalContext` for bounded follow-up notices only.
- Because Codex hooks block, the apply must be fast or bounded — it only runs when an upgrade is actually pending (gated by `.update-cache.json` + 24h cooldown), so cost is ≤ once/day; confirm that's acceptable vs. a deferred/background strategy.
- Reuse `.update-cache.json`, cooldown, strike counter, git pre-flight unchanged.
- Mind the Codex config patch mechanism (`schema.ts` textPatches + `unpatchContent`) so setup/upgrade/reset add/remove the hook cleanly. Verify Claude Code behavior untouched; update parity/coverage.

## Open questions

- What `timeout` is safe for a real `bunx safeword upgrade` apply on Codex? Does exceeding it corrupt the session or just skip?
- Should a future version move the apply to a less latency-sensitive trigger if real installs prove too slow?

## Work Log

- 2026-06-20T12:54:31.996Z Created (child of BJX7WR). Blocked on epic figure-it-out.
- 2026-06-24T18:00:00-07:00 Unblocked after figure-it-out and quality-review selected a single Codex SessionStart dispatcher. Started implementation on `codex/issue-393-codex-auto-upgrade`.
- 2026-06-24T18:24:00-07:00 Implemented shared auto-upgrade core, Claude wrapper, Codex SessionStart dispatcher, rollback helper, schema/template wiring, dogfood hook sync, and focused tests. Phase -> verify.
- 2026-06-25T04:43:23Z Caught branch up to `origin/main` after committing the #427 prerequisite. Reapplied #393 work cleanly, fixed a post-rebase Bun module-cache/order issue by moving SAFEWORD.md context helpers into `hooks/lib/safeword-context.ts`, and reverified: focused #393 set (6 files, 109 tests), typecheck, Gherkin lint, and `test:smoke:fast` (51 files, 667 tests) all passed.
- 2026-06-25T04:46:17Z Reran dogfood `safeword upgrade` on the caught-up base to sync `.safeword/version` to v0.57.0; it exited 0 while reporting the pre-existing feature-lineage health warnings. Dispatcher smoke after the sync passed (`bun run test tests/integration/hooks.test.ts -t "session-codex-start"`).
