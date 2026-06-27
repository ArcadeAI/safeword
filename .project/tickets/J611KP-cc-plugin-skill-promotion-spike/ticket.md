---
id: J611KP
slug: cc-plugin-skill-promotion-spike
type: task
phase: intake
status: in_progress
created: 2026-06-27T17:01:38.719Z
last_modified: 2026-06-27T17:01:38.719Z
---

# Spike: promote a few skills into the Claude Code plugin (proof-of-life)

**Goal:** Prove that safeword's static agent layer (skills) can ship from the `plugin/` directory and be discovered by Claude Code from the plugin cache — without double-vision against the CLI-installed `.claude/skills/` copy — and validate the plugin↔CLI version handshake.

**Why:** Three `/figure-it-out` runs (Claude Code, Codex, Cursor) converged on one architecture: the plugin ships the static agent layer; the CLI keeps the runtime hooks + project-state reconciler; everything is generated from one source tree. Before committing to that migration across all three platforms, the cheapest derisking is the Claude Code path — no tier gate, no enforcement caveats. This spike answers the two questions that decide whether the whole direction is viable: (1) does plugin-shipped skill discovery work cleanly alongside the CLI, and (2) can we detect plugin↔runtime version skew loudly instead of failing silently.

## Context (from the figure-it-out runs)

- Today `plugin/` is a thin bootstrap (a SessionStart nudge to run `bunx safeword setup`); the CLI copies all 17 skills into `.claude/skills/` via the reconciler. Skills are pure `SKILL.md` prose with no runtime — the safest piece to move.
- Hard constraint: a Claude Code plugin is copied to a read-only cache (`~/.claude/plugins/cache`) and cannot write project files. So **only the static layer moves**; hook runtime and the reconciler stay in the CLI. This spike does NOT move any hooks' runtime.
- Version skew is the shared killer risk: an auto-updated plugin running ahead of a lagging CLI-managed `.safeword/` runtime. The `.safeword/version` file (written by the CLI, read by `session-version.ts`) is the natural handshake anchor.

## Scope

- Promote **3 skills** — `figure-it-out`, `debug`, `testing` (no project-state dependency) — into `plugin/skills/<name>/SKILL.md`, copied from `packages/cli/templates/skills/`.
- Point the repo's own `.claude/settings.json` `enabledPlugins` at the local `./plugin` so the repo dogfoods its own plugin; confirm Claude Code discovers the 3 skills **from the plugin**, and that the CLI's reconciler no longer also writes those 3 into `.claude/skills/` (no double-vision). Use the schema's existing `deprecatedDirs`/`deprecatedFiles` mechanism to remove the CLI-installed copies of exactly those 3.
- Add a read-only `plugin/hooks/session-version.ts` plus a `plugin/hooks/lib/run-bun.sh` bun-or-`npx tsx` shim, wired via `${CLAUDE_PLUGIN_ROOT}` in `plugin/hooks/hooks.json`. The hook reads the `compat` band from `${CLAUDE_PROJECT_DIR}/.safeword/version` and `exit 2`s with an actionable message on a band mismatch only (never on ordinary minor/patch drift).
- Have the CLI write a `compat=1` line into `.safeword/version` on setup/upgrade; ship the matching `PLUGIN_COMPAT = 1` constant in the plugin hook.
- Re-anchor parity for the 3 moved skills: drop their `ownedFiles[].template` entries from `SAFEWORD_SCHEMA`; add two parity contracts to `scripts/parity-check.ts` — (a) `marketplace.json` plugin version == `packages/cli/package.json` version (fold in the existing pre-commit check), (b) plugin `PLUGIN_COMPAT` == the `compat` the CLI writes.
- Verify the round-trip on (a) a bun-absent environment — the `run-bun.sh` `npx tsx` fallback must fire — and (b) a stale-plugin / fresh-CLI `compat` mismatch — the `exit 2` skew message must fire with the correct "which side is stale" instruction.

## Out of scope

- Moving the remaining 14 skills, slash commands, or any read-only hooks — deferred to the follow-up rollout if the spike holds.
- Moving any **state-writing** hook runtime (quality-state, learnings sync, architecture staging, config-guard) — these `writeFileSync` project state and shell out to the CLI; they stay CLI-installed permanently.
- The Codex and Cursor plugins — the same one-source-tree build fans out to them only after the CC path is proven.
- The private-marketplace distribution config (`extraKnownMarketplaces`) — the spike uses a local `./plugin` source, not a remote private marketplace.
- Cursor `.mdc` rules and any platform-specific manifest generation.

## Done when

- Claude Code discovers `figure-it-out`, `debug`, `testing` from `./plugin` (not the CLI copy); the CLI reconciler no longer writes those 3 into `.claude/skills/`, and a fresh setup/upgrade leaves no duplicate — **no double-vision** observed.
- `plugin/hooks/session-version.ts` fires on SessionStart via `${CLAUDE_PLUGIN_ROOT}`, runs on a bun-absent box through the `run-bun.sh` fallback, and `exit 2`s with the correct stale-side message on a `compat` band mismatch — verified by forcing skew.
- The two new parity contracts pass; the 3 moved skills are out of the byte-parity `ownedFiles` set; full suite + lint green.
- A one-paragraph verdict recorded in the work log: **promote the remaining skills** / **adjust the approach** / **abandon** — with the concrete reason, so the follow-up rollout ticket (or its cancellation) is unambiguous.

## Work Log

- 2026-06-27T17:01:38.719Z Started: Created ticket J611KP
- 2026-06-27T17:02:00.000Z Scoped from three `/figure-it-out` runs (Claude Code, Codex, Cursor) on private-plugin shape. All three converged: plugin ships static agent layer, CLI keeps runtime + reconciler, one source tree, version-skew is the shared risk. This spike derisks the cheapest path (CC, 3 skills + version handshake) before any cross-platform rollout.
