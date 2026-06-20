---
id: BX6JS6
slug: claude-plugin-distribution
type: task
phase: intake
status: in_progress
relates_to: [D6GTXY, BJX7WR, DXYKJX]
created: 2026-06-20T19:18:22.605Z
last_modified: 2026-06-20T19:18:22.605Z
---

# Spike: ship safeword's Claude Code surface as a fattened plugin

**Goal:** Determine whether safeword can distribute its **Claude Code** surface (hooks + skills + commands) via a **fattened plugin** — auto-updated natively, run as readable scripts — instead of materializing those files into each repo, while preserving "commit once → the whole team gets it."

**Why:** This dodges _both_ tradeoffs of the hooks-into-CLI idea ([D6GTXY](../D6GTXY-hooks-into-cli-spike/ticket.md)): the plugin ships **readable source files** (not an opaque bundled binary) and hooks **run as `bun` scripts** (no per-invocation CLI cold-start) — yet upgrades become **native plugin auto-update with zero reconcile**. The infra already exists: `plugin/` + `marketplace.json` (currently a thin bootstrap-only plugin).

## Verified facts (this session)

- **Repo-committed auto-enable works for Claude Code.** A project `.claude/settings.json` with `extraKnownMarketplaces` + `enabledPlugins` makes Claude Code auto-install + enable the plugin for any teammate who opens the repo, then auto-update it. ([discover-plugins](https://code.claude.com/docs/en/discover-plugins.md), [plugin-marketplaces](https://code.claude.com/docs/en/plugin-marketplaces.md))
- **The trust gate is not new friction.** Committed settings (plugin install + hooks) load only after a **one-time workspace-trust** approval — but safeword's _current_ committed hooks already require that same gate. So the plugin is **not a DX downgrade**; it adds native auto-update on top. ([plugins-reference](https://code.claude.com/docs/en/plugins-reference.md))
- **Plugin ships readable hooks/skills/commands** run from `~/.claude/plugins/cache/...` via bun, auto-registered (no repo `settings.json` hook block needed), `${CLAUDE_PLUGIN_ROOT}` for bundled code + `${CLAUDE_PROJECT_DIR}` for project state. ([plugins.md](https://code.claude.com/docs/en/plugins.md))

## Scope: Claude Code only (the asymmetry is decided, not a question)

| Agent           | Repo-committed "team auto-gets it"?                                    | This ticket                                                                                                |
| --------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Claude Code** | ✅ `extraKnownMarketplaces` + `enabledPlugins`                         | **plugin (this spike)**                                                                                    |
| **Cursor**      | ❌ no repo-committed auto-enable ("Required" is org/admin-level, SCIM) | stays materialized / org Required mode → [DXYKJX](../DXYKJX-cursor-marketplace-plugin-packaging/ticket.md) |
| **Codex**       | ❌ no plugin marketplace                                               | stays materialized                                                                                         |

End state is **hybrid, best-path-per-agent**: Claude → plugin; Cursor/Codex → materialized. If this spike succeeds it likely **demotes D6GTXY (hooks-into-CLI) to a fallback**.

## The core refactor this must validate

`.safeword/` today mixes **code** (hooks, lib, skills, guides, templates) and **project state** (config.json, `.update-cache.json`, version, logs, `.project/` knowledge). The plugin can carry the **code** (read via `${CLAUDE_PLUGIN_ROOT}`); the **state stays in the repo** (read/written via `${CLAUDE_PROJECT_DIR}`). The spike must prove that split is clean — i.e. hooks consistently read _their own code_ from the plugin root and _project state_ from the project dir.

## Feasibility audit findings

**Verdict: feasible, no hard blockers** (Explore audit, 2026-06-20).

**The decisive plus — bootstrapping problem vanishes.** Every hook imports **only `node:*` / Bun globals — zero third-party npm packages**. So a plugin needs no `node_modules`; hooks run directly under bun from the plugin cache. This is the exact bootstrapping chicken-and-egg that dogged the CLI path ([D6GTXY](../D6GTXY-hooks-into-cli-spike/ticket.md)) — gone here.

**Hook config features all supported.** `SETTINGS_HOOKS` uses `matcher`, `if`, and `asyncRewake`; plugin `hooks/hooks.json` is the same format and auto-registers — so the auto-upgrade hook's `asyncRewake` and the matchered PreToolUse/PostToolUse hooks port directly.

**State↔code split is already clean** — `SAFEWORD_TRANSIENT_PATHS` (schema.ts) enumerates state; no hook interleaves code-dir and state-dir reads. Confirm in the spike.

**Bucket map:**

- **Plugin-movable (code, read via `${CLAUDE_PLUGIN_ROOT}`):** `hooks/` (+`lib/`, `cursor/`, `codex/`), `guides/`, `templates/`, `prompts/`, `scripts/`, `statusline/` (~95 files).
- **Must stay materialized in repo:** `SAFEWORD.md`, `.safeword/config.json`, `.safeword/.version`, `.update-cache.json` + all `.project/` state (read/written via `${CLAUDE_PROJECT_DIR}`); `AGENTS.md`/`CLAUDE.md`, `.cursor/rules`, `.codex/config.toml` (harness/other-tool fixed paths); language-pack lint/format configs.
- **Needs-refactor (adaptations, all LOW risk — no hard blockers):**
  1. Path substitution in generated hook commands: `${CLAUDE_PROJECT_DIR}/.safeword/hooks` → `${CLAUDE_PLUGIN_ROOT}/...` for code; keep `${CLAUDE_PROJECT_DIR}` for state. (`config.ts` builder.)
  2. Generate `plugin/hooks/hooks.json` from `SETTINGS_HOOKS` at build/release time.
  3. `schema.ts` ownedDirs/ownedFiles: drop the hook/guide entries the plugin now owns; `setup` skips materializing them.
  4. Skill/guide docs: ~1 hard skill→skill ref + assorted `.safeword/guides/...` path mentions to soften to implicit references.
  5. Release workflow: copy templates → `plugin/` + emit `hooks.json` before publish. Version-sync (package.json ↔ marketplace.json) already enforced — unchanged.
  6. Dogfood/parity: shift the byte-parity pair from template↔`.safeword/` to template↔`plugin/` (release-time), keep the dogfood-direction guard.

**Phasing (audit recommendation): Phase 1 = hooks only** (zero user-facing change — hooks auto-register, no namespace impact). **Defer skills to Phase 2** — plugin skills are namespaced `/safeword:bdd` vs today's `/bdd`, a real UX change worth its own decision.

> Caveat: the above is the audit agent's reading (some line refs are approximate); the spike confirms specifics before any migration.

## Open questions (for the audit + figure-it-out)

- Skill namespacing: `/safeword:bdd` vs today's `/bdd` — acceptable UX, or a blocker? Do skill bodies/`@`-refs hardcode `.claude/skills/...` paths that break under the plugin namespace?
- Which materialized files are irreducible (SAFEWORD.md, AGENTS.md/CLAUDE.md import block, language-pack lint configs) and stay in `safeword setup`'s shrunken footprint?
- Does the plugin `hooks/hooks.json` support every feature SETTINGS_HOOKS uses (matchers, `async`, `asyncRewake`, `if`)?
- Dogfood/parity: how does the dev model change when `plugin/` becomes the source of the hooks/skills (vs templates → `.safeword/` mirror)?
- Enterprise default-off for third-party plugins — does safeword need a managed-settings story, with the materialized path as fallback?

## Smallest viable spike

Phase-1 scope = **hooks only** (skills deferred). Move ONE hook (e.g. `session-version` or the `asyncRewake` auto-upgrade hook) into the plugin with `${CLAUDE_PLUGIN_ROOT}` paths, wire `extraKnownMarketplaces` + `enabledPlugins` in a throwaway test repo, confirm: (1) trust-then-auto-install, (2) the hook fires from the plugin cache and reads/writes project state via `${CLAUDE_PROJECT_DIR}`, (3) bumping the plugin version auto-updates with no reconcile, (4) readable in cache, (5) `asyncRewake`/matcher features work from `hooks/hooks.json`. Throwaway prototype; deliverable is go/no-go + the refactor map.

## Work Log

- 2026-06-20T19:18Z Created from the readable-is-the-goal /figure-it-out. Plugin chosen for the Claude surface (readable + fast + native auto-update; repo-committed auto-enable verified; trust gate = same as today). Feasibility audit launched.
- 2026-06-20T19:25Z Feasibility audit landed: **no hard blockers.** Decisive plus — hooks have ZERO third-party deps, so the plugin needs no node_modules and the CLI-path bootstrapping problem disappears. All hook-config features (matcher/if/asyncRewake) supported by plugin hooks.json; state↔code split already clean (SAFEWORD_TRANSIENT_PATHS). Six LOW-risk adaptations identified (path substitution, generate hooks.json, schema ownedDirs, soften skill/guide path refs, release copy step, parity scope shift). Phasing: Phase 1 = hooks only (no UX change); defer skills (Phase 2) due to `/safeword:` namespace impact.
