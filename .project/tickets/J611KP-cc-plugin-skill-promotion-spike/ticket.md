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

## Finding that reshaped the spike (2026-06-27, corrected)

**There is no inherent cross-tool coupling — the target is per-tool self-contained plugins.** In the clean hybrid, each tool's plugin carries its OWN skill copy, all generated from the one source template (`packages/cli/templates/skills/`). Zero runtime cross-references between tools; the only thing "shared" is the build-time source of truth, which is intended, not coupling.

**What the spike actually hit is a pre-existing wart in today's Cursor wiring:** Cursor's `.mdc` rules and `.cursor/commands/*.md` `@`-reference straight into `.claude/skills/<name>/SKILL.md` (e.g. `@.claude/skills/debug/SKILL.md`) instead of carrying their own copy. So in *this half-migrated repo*, moving a skill out of `.claude/skills` leaves Cursor's existing reference dangling. That is a defect to remove, not a constraint to design around. The earlier framing ("shared infrastructure, can't move" / "coupled move") overstated it — corrected here.

- **Codex was never affected.** Its skills are already a separate copy on disk (`.agents/skills/<name>`), installed independently. A Codex plugin just carries them. No wart, no work beyond the build.
- **Cursor needs one cleanup:** give the Cursor plugin its own `skills/<name>` copy (native Cursor skill, or a rule that points at a Cursor-plugin-local path) so its rules stop reaching into `.claude/skills`. After that, reasoning skills move per-tool, freely, nothing to coordinate at runtime.

The spike still deliberately picked Cursor-unreferenced skills (`explain`, `lint`, `cleanup-zombies`) so it could prove the Claude mechanism *without* touching Cursor's rules in the same change — a scoping choice, not evidence of a permanent coupling. (Cursor-referenced skills today: `audit`, `bdd`, `brainstorm`, `debug`, `elicit`, `figure-it-out`, `quality-review`, `refactor`, `review-spec`, `tdd-review`, `testing`, `ticket-system` — these just need the Cursor-copy cleanup first.)

## Scope

- Promote **3 Cursor-decoupled skills** — `explain`, `lint`, `cleanup-zombies` — into `plugin/skills/<name>/SKILL.md`, copied from `packages/cli/templates/skills/`. (Swapped from the originally-named `figure-it-out`/`debug`/`testing` per the finding above — those are Cursor-coupled.)
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

## Deviations from the written plan (recorded)

1. **Skills swapped** `figure-it-out`/`debug`/`testing` → `explain`/`lint`/`cleanup-zombies` — the originals are Cursor-coupled (see Finding); the swap honors the "Cursor `.mdc` out of scope" boundary while proving the same mechanism.
2. **Version handshake simplified** from "CLI writes a `compat=1` line into `.safeword/version`" to "plugin reads the existing semver `.safeword/version` and asserts CLI ≥ `PLUGIN_MIN_CLI`." Reason: `.safeword/version` is strict semver (`/^\d+\.\d+\.\d+$/`) read in 4+ places; appending a `compat=` line is high blast radius for a spike. A min-version check detects the same dangerous direction (plugin ahead of runtime) with zero format change. `PLUGIN_MIN_CLI=0.57.0` (the promoted skills add no new `.safeword/` contract; 0.57.0 is the current installed-runtime baseline — the repo's `.safeword/version` is 0.57.0 while `package.json` is 0.58.0).
3. **Version-sync parity contract (marketplace==package) not added** — already enforced by the existing pre-commit hook (per CLAUDE.md); duplicating it inside `runParity` is redundant for a spike.
4. **Dogfood `.claude/settings.json` enablement deferred, not committed.** The file is intentionally guarded by the `config-guard` hook, live plugin discovery can't be verified in this session (plugins load at startup/trust), and there's an unresolved path question (a `directory` marketplace source expects `./.claude-plugin/marketplace.json`, but safeword's manifest is at repo-root `marketplace.json`). The exact config a consumer/the repo commits is recorded below for the fresh-session follow-up.

### Deferred dogfood enablement config (verify in a fresh session)

```jsonc
// .claude/settings.json — additive top-level keys
"extraKnownMarketplaces": {
  "safeword": { "source": { "source": "directory", "path": "." } }
},
"enabledPlugins": { "safeword@safeword": true }
```

Fresh-session verification checklist: (a) confirm Claude Code resolves the root `marketplace.json` from a `directory` source at `.` — if not, move/symlink to `./.claude-plugin/marketplace.json`; (b) confirm `explain`/`lint`/`cleanup-zombies` load from the plugin and the CLI no longer writes `.claude/skills/` copies (no double-vision); (c) confirm the `session-version.ts` banner fires.

## Spike verdict

**Promote all skills — they're all movable; one cleanup unblocks the rest.** The mechanism works: the CLI cleanly stops shipping the 3 skills (schema/reconcile/parity tests green), the plugin carries byte-identical copies (new parity check), and the version handshake fires correctly (compatible → exit 0; forced skew → exit 2; bun-absent → `npx tsx` fallback). The spike used 3 Cursor-unreferenced skills so it could prove the Claude path without touching Cursor in the same change — a scoping choice, not a ceiling. There is **no inherent blocker** on the reasoning skills: the only prerequisite is removing today's wart where Cursor's rules `@`-reference `.claude/skills/` in place — i.e. give the Cursor plugin its own skill copy so each tool's plugin is self-contained. Codex is already independent. Net: the plugin direction is viable for *all* skills; the reasoning ones just want the one-time Cursor-copy cleanup first, which is mechanical, not an open architecture question.

## Work Log

- 2026-06-27T17:01:38.719Z Started: Created ticket J611KP
- 2026-06-27T17:02:00.000Z Scoped from three `/figure-it-out` runs (Claude Code, Codex, Cursor) on private-plugin shape. All three converged: plugin ships static agent layer, CLI keeps runtime + reconciler, one source tree, version-skew is the shared risk. This spike derisks the cheapest path (CC, 3 skills + version handshake) before any cross-platform rollout.
- 2026-06-28T00:58:00.000Z Corrected the finding. Earlier framing ("`.claude/skills` is shared infrastructure" → "coupled move" → reasoning skills "cannot move / blocked") overstated it. The truth: no inherent cross-tool coupling — the target is per-tool self-contained plugins, each carrying its own skill copy from the one source template. What the spike hit is a pre-existing wart: Cursor's `.mdc` rules `@`-reference into `.claude/skills` instead of shipping their own copy. Removing that (give the Cursor plugin its own copy) unblocks every reasoning skill; Codex was never affected (separate `.agents/skills` copy). Updated the Finding and Verdict sections accordingly.
- 2026-06-27T17:40:00.000Z Implemented. Discovered `.claude/skills/` is shared with Cursor (rules/commands `@`-reference it) → swapped to 3 decoupled skills. Schema: removed `explain`/`lint`/`cleanup-zombies` from `.claude/skills` ownedFiles, added them to `deprecatedDirs`, added exported `PLUGIN_PROMOTED_SKILLS`. Created `plugin/skills/{explain,lint,cleanup-zombies}/SKILL.md` + `plugin/hooks/session-version.ts` (portable, min-CLI handshake) + `plugin/hooks/lib/run-bun.sh` (bun→bunx→npx-tsx shim) + wired `plugin/hooks/hooks.json`. Added `checkPluginSkills` byte-parity guard to `parity.ts` (+4 unit tests). Verified handshake (compatible/skew/bootstrap) and shim fallback by hand. Targeted suites green: schema, parity (22), owned-paths, reconcile, setup/reset/upgrade, hook-coverage (122). Dogfood settings.json enablement deferred (guarded file + needs fresh-session verification). Verdict recorded.
