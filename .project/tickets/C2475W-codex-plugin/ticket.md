---
id: C2475W
slug: codex-plugin
type: feature
phase: intake
status: in_progress
relates_to: J611KP
scope:
  - Ship a Codex plugin (.codex-plugin/plugin.json) that bundles skills
  - Distribute via a private .agents/plugins/marketplace.json git repo
  - Generate the plugin from the one source tree; parity-guard it
out_of_scope:
  - Moving hook runtime into the plugin (stays CLI; Codex hooks can't hard-enforce)
  - The reconciler / project-state layer (CLI only)
  - Removing the npm CLI
done_when:
  - Adding the marketplace + enabling the plugin gives a Codex user the skills
  - Skills load with no duplicate vs the CLI-written .agents/skills copy
  - Full suite + lint + real parity-check green
created: 2026-06-28T04:50:07.284Z
last_modified: 2026-06-28T04:50:07.284Z
---

# Codex plugin: ship the agent layer via a (private) Codex marketplace

**Goal:** Distribute safeword's agent layer (skills) to Codex as a real Codex plugin (`.codex-plugin/`) via a marketplace git repo, instead of only the CLI writing `.agents/skills/` into each project.

**Why:** Codex shipped a near-clone of Claude Code's plugin + marketplace system (Mar 2026). A plugin gives Codex users discoverable, upgradeable distribution of the agent layer — and a private marketplace gives company-only distribution. The CLI keeps the project-state layer (it can't be a plugin). Parallels J611KP (Claude) for Codex.

## Decision basis (from the per-platform `/figure-it-out`, 2026-06-27)

**Thin plugin = skills only; hooks + project-state stay CLI-written.** Skills are the only project-agnostic, runtime-free, format-portable piece — and Codex reads the same `SKILL.md`. Hooks stay in the CLI because (a) they read/write `.safeword/` project state and (b) Codex hooks can't hard-enforce (PreToolUse is a guardrail that misses some shell calls + WebSearch; only `type:"command"` runs).

## Evidence (verify current at build — developers.openai.com/codex, fast-moving)

- Plugin manifest `.codex-plugin/plugin.json` (requires `name`/`version`/`description`); bundles skills via `skills: "./skills/"`, plus hooks/MCP/apps.
- Marketplace = git repo; manifest at `$REPO_ROOT/.agents/plugins/marketplace.json` (also reads legacy `.claude-plugin/marketplace.json`). CLI: `codex plugin marketplace add owner/repo [--ref]`.
- Private = point at a private git repo (git-access gated). **No project-clone auto-prompt** — each teammate runs `marketplace add` manually. `policy.installation: "INSTALLED_BY_DEFAULT"` removes the per-plugin pick once the marketplace is added.
- Skills already install at `.agents/skills/<name>/SKILL.md` today (full copies from the one template) — the plugin carries the same content.

## Scope

- `.codex-plugin/plugin.json` + bundled `skills/<name>/SKILL.md`, generated from `packages/cli/templates/skills/` (one source tree; parity-guarded like J611KP's `checkPluginSkills`).
- Map safeword slash commands → Codex skills (Codex has no slash-command unit; `disable-model-invocation` skills give `/name`).
- Private marketplace: `.agents/plugins/marketplace.json` in a private repo + the `codex plugin marketplace add` flow. Address the missing auto-prompt (AGENTS.md note + a `safeword codex onboard` one-shot + `INSTALLED_BY_DEFAULT`).

## Out of scope

- Hook runtime in the plugin — stays CLI (`.safeword/hooks`); document the honest enforcement degradation on Codex.
- Project-state layer (reconciler, linters, packs, tickets) — CLI only.
- Removing the npm CLI — stays for CI / non-plugin paths.

## Open questions

- **Dedup vs CLI copy.** Codex reads `.agents/skills/` (CLI-written) AND the plugin's bundled skills. Same risk as 6CT4D0/Cursor — verify Codex loads each skill once, or have the plugin own them and stop the CLI writing `.agents/skills` for plugin users.
- **Shared vs forked manifest.** Codex `plugin.json` requires `version` (Claude's must omit it); marketplace schemas differ. Confirm what's shared with the Claude plugin (the `SKILL.md` bodies) vs forked (manifests) — likely one source tree, forked manifests.

## Work Log

- 2026-06-28T04:50:07.284Z Created. Codex analogue of J611KP: skills-only plugin via a private `.agents/plugins/marketplace.json`; hooks + project-state stay CLI; generated from one source tree. Decision basis from the 2026-06-27 per-platform figure-it-out.
