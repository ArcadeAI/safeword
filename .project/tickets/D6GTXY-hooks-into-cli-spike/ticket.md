---
id: D6GTXY
slug: hooks-into-cli-spike
type: task
phase: intake
status: in_progress
created: 2026-06-20T14:57:43.620Z
last_modified: 2026-06-20T14:57:43.620Z
---

# Spike: hooks dispatched from the CLI (latency + wiring)

**Goal:** Falsify (or confirm) the load-bearing assumption behind moving safeword's hook layer into the CLI — that a CLI-dispatched hook can run at ~the direct-script latency baseline — with the smallest possible prototype, and produce a go/no-go + migration strategy.

**Why:** Hooks + lib are 52/139 owned files (37% of the materialized footprint) and the part that churns most on upgrade. Moving them to `safeword hook <name>` subcommands would turn logic-only releases into a one-line version bump, collapse cross-agent into a shared binary (may subsume the per-agent ports in [BJX7WR](../BJX7WR-auto-upgrade-cross-agent/ticket.md)), and partially re-enable Dependabot/Renovate. The whole bet hinges on hot-hook latency — this spike measures it before any migration.

**Related:** [BJX7WR — cross-agent auto-upgrade](../BJX7WR-auto-upgrade-cross-agent/ticket.md) (this spike gates whether that epic does per-agent script ports or wires all agents to one CLI dispatch). Not a child — hooks-into-CLI is broader than cross-agent.

## Hypothesis (the thing to falsify)

> A lean `safeword hook <name>` entry that dynamic-`import()`s only the requested hook runs within ~1.5× of the direct-`bun script.ts` baseline (~32ms warm), even for a heavy hook.

- **Pass** (lean dispatch ≤ ~1.5× baseline): full hook→CLI migration is viable.
- **Fail** (closer to the full-CLI ~53/83ms cold start): partial migration only — hot per-tool hooks stay materialized, cold hooks (session-start, the auto-upgrade hook) move.

## Protocol (do exactly this — descope everything else)

1. Pick the **hottest, heaviest** hook: `post-tool-quality.ts` (fires on every edit; pulls in the quality/lint libs — representative of the real import graph, NOT a toy).
2. Implement TWO CLI paths for it:
   - **Naive:** an ordinary commander subcommand `safeword hook post-tool-quality` (loads the full CLI graph).
   - **Lean:** a minimal dispatch entry that parses argv directly and dynamic-`import()`s only the one hook module (no commander, no command graph).
3. **Measure three numbers**, cold and warm, several runs each:
   - Baseline: `bun .safeword/hooks/post-tool-quality.ts` (today) — ~32ms warm reference.
   - Naive CLI subcommand.
   - Lean dynamic-import dispatch.
     (Use the published-shape path too — `node dist/...` — since that's what customers run, not `bun src`.)
4. **Wiring smoke test (Claude Code only):** wire the one hook via the CLI path in `.claude/settings.json` and confirm it fires + behaves identically in a real session.
5. Record the **resolution decision** for the full migration (don't build it): recommend **local devDependency → `node_modules/.bin/safeword hook X`** (per-repo pinned, reproducible, no network) and note the resolution one-liner.

## Must surface (don't solve — feed the epic)

- **Bootstrapping chicken-and-egg:** if the CLI lives in node_modules, hooks can't run before `bun install` — but the `dependency-readiness` hook is what guards that. So the readiness hook (and maybe `session-bun-check`) must stay materialized, or the dispatch must degrade gracefully when node_modules is absent. Document the boundary.
- **Pin coherence:** `.safeword/version` ↔ the `safeword` devDep version must move together (the existing upgrade flow already syncs the version specifier — confirm it covers this).
- **Cross-agent wiring shape** for Cursor (`.cursor/hooks.json`) and Codex (`config.toml`) — note the command string each needs; do NOT implement.

## Explicitly out of scope (this is a spike)

- Migrating the other 51 hook/lib files.
- Solving bootstrapping cleanly (just expose it).
- Cursor/Codex wiring (just document the command shape).
- Any production code that ships — the prototype is throwaway; the deliverable is the **numbers + the go/no-go + migration strategy** written back here.

## Done when

- [ ] Three latency numbers (baseline / naive / lean), cold + warm, recorded here.
- [ ] Go/no-go stated against the ~1.5×-baseline bar, with the resulting migration strategy (all-hooks vs hot-stay-materialized).
- [ ] One-agent (Claude) wiring smoke test passed with identical hook behavior.
- [ ] Bootstrapping + pin-coherence + cross-agent-wiring-shape notes captured for the epic.

## Premortem

The spike greenlights on a warm cache + a light hook, then real hot hooks drag the dynamic-import graph back to full-CLI cost in production. Mitigation: use the genuinely heavy `post-tool-quality` (real lib imports) and measure **cold** as well as warm.

## Work Log

- 2026-06-20T14:57:43.620Z Created. Conceptual /figure-it-out done: gating risk is hot-hook latency; prototype measures 3 paths (baseline/naive/lean) on the hottest hook; resolution recommendation = local devDep bin; bootstrapping (readiness hook) flagged. Throwaway prototype; deliverable is the decision.
