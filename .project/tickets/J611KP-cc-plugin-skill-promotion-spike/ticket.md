---
id: J611KP
slug: cc-plugin-skill-promotion-spike
type: task
phase: intake
status: in_progress
created: 2026-06-27T17:01:38.719Z
last_modified: 2026-06-28T03:15:00.000Z
---

# Spike: promote skills into the Claude Code plugin (proof-of-life)

**Goal:** Prove a skill can ship from the `plugin/` directory and be the sole source on Claude (no double-vision against a CLI-installed `.claude/skills/` copy), and that plugin↔CLI version skew is detected loudly rather than failing silently.

**Why:** Three `/figure-it-out` runs converged on one hybrid: the plugin ships the static agent layer (skills), the CLI keeps the runtime hooks + project-state reconciler, everything generated from one source template. The Claude path is the cheapest derisk (no tier gate, no enforcement caveats) before any cross-platform rollout.

## What was built (as-built)

- **3 skills promoted** — `explain`, `lint`, `cleanup-zombies` — copied from `packages/cli/templates/skills/` into `plugin/skills/<name>/SKILL.md`. Removed from `SAFEWORD_SCHEMA.ownedFiles` and added to `deprecatedDirs` (so `upgrade` deletes the stale CLI copies); the dogfood `.claude/skills/` copies were deleted. Added exported `PLUGIN_PROMOTED_SKILLS`.
- **Version handshake** — `plugin/hooks/session-version.ts` (portable `node:fs`; reads the existing semver `.safeword/version` and `exit 2`s with a fix command when the CLI runtime is older than `PLUGIN_MIN_CLI=0.57.0`) + `plugin/hooks/lib/run-bun.sh` (bun → bunx → `npx tsx` shim) wired via `${CLAUDE_PLUGIN_ROOT}` in `plugin/hooks/hooks.json`.
- **Parity** — `checkPluginSkills` in `parity.ts` guards `plugin/skills/<name>` byte-identical to the template (Codex's `.agents/skills/` still installs from it), in both modes, +4 unit tests.
- **Verified** — handshake (compatible → exit 0, forced skew → exit 2, no-`.safeword` → silent) and the bun-absent `npx tsx` fallback by hand; full suite 3831 passed; real parity-check 182 pairs + 3 contracts; lint + typecheck green. Committed + pushed.

Why these 3 skills: they are the ones with no Cursor reference, so the Claude promotion could be proven without touching Cursor in the same change (see Finding). Two intended pieces were dropped as not worth it for a spike: the `compat`-band line in `.safeword/version` (high blast radius — it's strict semver read in 4+ places; a min-version check catches the same skew with no format change), and a marketplace==package version parity contract (the pre-commit hook already enforces it).

## Finding: there is no inherent cross-tool coupling

The target is **per-tool self-contained plugins** — each carries its own skill copy generated from the one source template, with zero runtime cross-references. The only thing "shared" is the build-time source, which is intended.

What the spike hit is a **pre-existing wart in Cursor's wiring**: Cursor's `.mdc` rules and `.cursor/commands/*.md` `@`-reference straight into `.claude/skills/<name>/SKILL.md` instead of carrying their own copy, so removing a skill from `.claude/skills` leaves Cursor dangling. That is a defect to remove, not a constraint — split out as **6CT4D0**. Codex was never affected (its `.agents/skills/<name>` is already a separate copy).

(Cursor-referenced skills today, which need 6CT4D0 first: `audit`, `bdd`, `brainstorm`, `debug`, `elicit`, `figure-it-out`, `quality-review`, `refactor`, `review-spec`, `tdd-review`, `testing`, `ticket-system`.)

## Verdict

**All skills are movable; one mechanical cleanup (6CT4D0) unblocks the reasoning ones.** The Claude mechanism works end-to-end. There is no architecture question left — just remove Cursor's `@.claude/skills` cross-references so each tool's plugin is self-contained, then the reasoning skills promote per-tool.

## Deferred: dogfood plugin enablement (verify in a fresh session)

Not committed — `.claude/settings.json` is guarded by the `config-guard` hook, and live plugin discovery can't be verified in-session (plugins load at startup/trust). The exact additive config a consumer/the repo commits:

```jsonc
"extraKnownMarketplaces": {
  "safeword": { "source": { "source": "directory", "path": "." } }
},
"enabledPlugins": { "safeword@safeword": true }
```

Fresh-session checklist: (a) confirm Claude Code resolves the root `marketplace.json` from a `directory` source at `.` — if not, move/symlink to `./.claude-plugin/marketplace.json`; (b) confirm the 3 skills load from the plugin and the CLI no longer writes their `.claude/skills/` copies (no double-vision); (c) confirm the `session-version.ts` banner fires.

## Work Log

- 2026-06-27T17:01:38.719Z Created from three `/figure-it-out` runs (Claude Code, Codex, Cursor) on private-plugin shape. Derisks the cheapest path (Claude, a few skills + version handshake) before cross-platform rollout.
- 2026-06-27T17:40:00.000Z Implemented + verified (see "What was built"). During implementation, found Cursor's rules/commands `@`-reference `.claude/skills`, so picked 3 Cursor-unreferenced skills to keep the spike Claude-only. Full suite green; committed + pushed.
- 2026-06-28T00:58:00.000Z Corrected the finding's framing: not "shared infrastructure / coupled / blocked" but "no inherent coupling — per-tool self-contained plugins; the only wart is Cursor's `@.claude/skills` cross-reference." Split the Cursor cleanup to 6CT4D0. Tightened the ticket (removed the abandoned `compat`-band design and stale skill names from Scope/Done-when).
