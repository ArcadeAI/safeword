---
id: BJX7WR
slug: auto-upgrade-cross-agent
type: epic
phase: intake
status: in_progress
epic: auto-upgrade-cross-agent
children: [Y6HZR7, 7R1D3B]
created: 2026-06-20T12:54:31.866Z
last_modified: 2026-06-20T12:54:31.866Z
---

# Epic: Cross-agent auto-upgrade (Cursor + Codex)

**Goal:** Extend safeword's seamless auto-upgrade — today Claude-Code-only — to the other two supported agents, Cursor and Codex, so customers on any agent stay current without manual `safeword upgrade`.

**Why:** Safeword distributes to three agents, but auto-upgrade is wired into Claude Code only. Cursor and Codex users get no auto-upgrade — they depend on the bootstrap "run setup" nudge + manual upgrades, which drifts. This undercuts the "seamless for customers" goal for a meaningful share of users.

## Foundation (done)

[XQ9CXA — auto-upgrade hardening](../XQ9CXA-auto-upgrade-hardening/ticket.md) hardened the Claude Code path: non-blocking (`asyncRewake`), lag-free (single check+apply pass), per-version strike counter, git-state pre-flight, `execFileSync` + semver hardening, and a supply-chain threat-model note. The **apply path** it produced (`bunx safeword@<latest> upgrade` + commit only safeword-owned files, gated by 24h release-age cooldown + opt-outs + dirty/detached/merge pre-flight) is **agent-agnostic** — it's just git + bunx. That logic is the reusable core.

## The hard constraint (the reason this is a real design problem, not just wiring)

The Claude Code design surfaces user-facing outcomes via the **`asyncRewake` + exit-2** contract (non-blocking; exit 2 delivers stderr to Claude as a system reminder). **Neither Cursor nor Codex has an equivalent:**

- **Cursor** (`.cursor/hooks.json`): hooks are `{command}` only — no async/background, no exit-code rewake. Exit 2 is a **blocking hook error**. (`config.ts` `CURSOR_HOOKS`, sessionStart runs only `session-safeword-context.ts`.)
- **Codex** (`.codex/config.toml`): synchronous hooks with `timeout` + `statusMessage`; no exit-code rewake. Exit 2 = **failure after timeout**. (SessionStart hook was removed in P30CRP.)

So naively wiring `session-auto-upgrade.ts` into Cursor/Codex would **break session start**, not just "not message." Each agent needs its own non-blocking strategy and its own (or no) message channel.

## Mechanism framing (steelman recalibration, 2026-06-20)

The **client session-hook is the primary/universal mechanism** — the only path that needs no GitHub/CI/token, is always-current at session start, self-healing, and matches the _seamless_ goal. A **CI/PR upgrade Action** (scheduled `safeword upgrade` → PR) is an **opt-in complement** for teams that want reviewable, scheduled, agent-agnostic upgrades and are on GitHub CI — NOT the default, and not the cross-agent answer unless the per-agent client port proves infeasible. **Dependabot rejected** (can't run reconcile; verified gap). **Renovate `postUpgradeTasks`** is a documented "if you already run Renovate" fallback only.

**First question this epic's /figure-it-out must answer:** the actual **agent mix** of safeword users (Claude-Code vs Cursor vs Codex). That decides whether per-agent client ports are worth it or whether a CI Action / the hooks-into-CLI move below is the better cross-agent vehicle.

**Bigger structural lever ([D6GTXY spike](../D6GTXY-hooks-into-cli-spike/ticket.md)):** moving the **hook layer into the CLI** (`safeword hook <name>` subcommands) would make all three agents' configs point at one shared binary — collapsing the apply logic from triplicated materialized scripts into one implementation. If pursued, it likely **subsumes the per-agent ports** (Y6HZR7/7R1D3B become "wire the agent's config to call `safeword hook`" rather than reimplement). Evaluate this BEFORE committing to per-agent script ports. Evidence: hooks+lib are 52/139 owned files (37%); MCP cannot host hooks/skills (filesystem-only); CLI cold-start +20–60ms (mitigable). Verified 2026-06-20.

## Shared design decision (resolve in epic-level /figure-it-out before the children build)

Likely shape — **silent apply + git-commit-as-record** on Cursor/Codex: do the upgrade + commit (the agent-agnostic core), skip the exit-2 messaging entirely (the commit in git history is the record), and find a per-agent way to avoid blocking session start. Open design questions the figure-it-out must settle:

- Can Cursor / Codex run a hook **non-blocking** at all? If not, is a bounded one-time blocking apply acceptable (it only fires when an upgrade is actually pending, ≤ once/day via the cooldown)?
- Where does the **shared apply core** live so all three agents call one implementation (extract from `session-auto-upgrade.ts` into a `lib/` function)?
- Do Cursor/Codex have a surfacing channel for the **major-available / blocked** messages, or do those degrade to silent + git-history only?
- Reuse `.update-cache.json` + the strike counter as-is (agent-agnostic) — confirm.

## Children

- [Y6HZR7 — Auto-upgrade under Cursor](../Y6HZR7-auto-upgrade-cursor/ticket.md)
- [7R1D3B — Auto-upgrade under Codex](../7R1D3B-auto-upgrade-codex/ticket.md)

A likely **slice 0** (shared, before either agent): extract the agent-agnostic apply core out of `session-auto-upgrade.ts` into a reusable `lib/` module so Claude/Cursor/Codex entry points are thin wrappers. Fold into whichever child goes first, or carve a small task.

## Acceptance (epic-level)

- [ ] Cursor users on a clean tree get patch/minor auto-upgrades without manual action, without breaking session start.
- [ ] Codex users likewise.
- [ ] All three agents share one apply implementation (no triplicated upgrade/commit logic).
- [ ] Per-agent message behavior is explicit (surfaced where the agent supports it, silent-with-git-record where it doesn't).
- [ ] Parity + the existing Claude Code behavior unchanged (no regression to XQ9CXA).

## Work Log

- 2026-06-20T12:54:31.866Z Started: Created epic BJX7WR. Surfaced during XQ9CXA verify: auto-upgrade is Claude-Code-only; the `asyncRewake`/exit-2 contract has no Cursor/Codex equivalent (exit 2 would block those). Apply path is portable; messaging is not. Children: Cursor (Y6HZR7), Codex (7R1D3B).
