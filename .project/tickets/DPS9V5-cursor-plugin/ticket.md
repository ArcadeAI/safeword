---
id: DPS9V5
slug: cursor-plugin
type: feature
phase: intake
status: in_progress
relates_to: 6CT4D0
scope:
  - Ship a Cursor plugin (.cursor-plugin/plugin.json) bundling skills + hooks.json wiring + MCP
  - Distribute via a private Team Marketplace (Required auto-install)
  - Generate the plugin from the one source tree; parity-guard it
out_of_scope:
  - Hook runtime in the plugin (stays CLI-installed; plugin carries only wiring)
  - The reconciler / project-state layer (CLI only)
  - Removing the npm CLI
done_when:
  - Enabling the plugin (Required) gives a Cursor user skills + hooks + MCP
  - Skills load once (no duplicate vs .agents/skills) — depends on 6CT4D0
  - Full suite + lint + real parity-check green
created: 2026-06-28T04:50:07.426Z
last_modified: 2026-06-28T04:50:07.426Z
---

# Cursor plugin: ship the agent layer via a (private) Team Marketplace

**Goal:** Distribute safeword's agent layer to Cursor as a real Cursor plugin (`.cursor-plugin/`) via a private Team Marketplace, instead of only the CLI writing `.cursor/` into each project.

**Why:** Cursor Plugins (2026) bundle skills + rules + hooks + MCP and distribute as git repos; **Team Marketplaces** (Teams/Enterprise) give private, company-only distribution with **Required** auto-install (tighter than Claude's auto-prompt). Cursor also has the richest hooks of the three (can hard-enforce). The CLI keeps the project-state layer. Depends on 6CT4D0 (Cursor self-contained skills) landing first.

## Decision basis (from the per-platform `/figure-it-out`, 2026-06-27)

**Plugin ships the static agent layer (skills + `hooks.json` wiring + MCP); the hook RUNTIME stays CLI-installed** (`.safeword/hooks/cursor/*`), because those scripts read/write `.safeword/` project state and shell out to the CLI. Bundling the wiring (not the runtime) keeps one runtime + one reconciler. A bootstrap rule/hook self-heals a fresh repo by running `safeword setup`.

## Evidence (verify current at build — cursor.com/docs, fast-moving)

- Plugin manifest `.cursor-plugin/plugin.json`; bundles rules/skills/agents/commands/hooks/MCP; distributed as git repos; multi-plugin via `.cursor-plugin/marketplace.json`.
- **Team Marketplaces** (Teams/Enterprise): admin imports a private GitHub repo; assign plugin to a SCIM-synced group as **Required** (silent auto-install) or Optional. Teams plan capped at 1 marketplace; arbitrary private-git-URL install outside a Team Marketplace is **undocumented** — verify.
- Cursor hooks are the richest (`beforeShellExecution`, `beforeReadFile`, `beforeSubmitPrompt`, …; exit 2 / `failClosed` hard-blocks) — net-new enforcement the Claude plugin can't express.
- Skills: native `SKILL.md` (open standard); 6CT4D0 moves Cursor onto `.agents/skills/`.

## Scope

- `.cursor-plugin/plugin.json` + bundled `skills/` (one `safeword-core.mdc` rule for always-on context) + `hooks/hooks.json` wiring → CLI-installed `.safeword/hooks/cursor/*` + `mcp.json`, generated from the one source tree (parity-guarded).
- Private Team Marketplace flow: `.cursor-plugin/marketplace.json` in a private repo, admin imports it, assigns Required to a SCIM group. Document the tier-gate fallback (committed `.cursor/` for non-Teams).
- Version-skew guard: a bootstrap `sessionStart` hook asserts the CLI runtime is compatible before arming `failClosed` hooks (degrade loudly to "run setup", never brick the editor).

## Out of scope

- Hook runtime in the plugin — stays CLI-installed; plugin carries only `hooks.json` wiring.
- Project-state layer (reconciler, linters, packs, tickets) — CLI only.
- Removing the npm CLI — stays for non-Teams fallback and non-plugin paths.

## Dependencies & open questions

- **Depends on 6CT4D0** — Cursor must already source skills self-contained from `.agents/skills/` before the plugin packages them.
- **Skill dedup** — same load-once question as 6CT4D0 (plugin skills vs `.agents/skills`).
- **Tier gate** — Team Marketplaces need Teams/Enterprise; confirm the private-git-URL path outside a Team Marketplace before promising a Pro-tier private install.
- **Native skill vs `.mdc` rule embedding** — keep rules to the single `safeword-core.mdc`; everything procedural is a skill.

## Work Log

- 2026-06-28T04:50:07.426Z Created. Cursor analogue of J611KP: plugin ships skills + hooks.json wiring + MCP via a private Team Marketplace (Required auto-install); hook runtime + project-state stay CLI; one source tree. Depends on 6CT4D0. Decision basis from the 2026-06-27 per-platform figure-it-out.
