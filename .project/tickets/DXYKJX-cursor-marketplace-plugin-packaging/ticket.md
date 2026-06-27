---
id: DXYKJX
slug: cursor-marketplace-plugin-packaging
type: task
phase: intake
status: in_progress
epic: cursor-optimization
relates_to: VAX3Z2
---

# Package safeword as Cursor Team-Marketplace plugin (Required mode)

**Goal:** Ship safeword as a Cursor Team-Marketplace plugin bundling hooks + rules + commands/skills + MCP, with "Required" install mode for enforcement.

**Why:** May 2026 Team Marketplace lets a plugin bundle all surfaces; "Required" mode is exactly safeword's enforcement posture. Cleaner than ad-hoc `.cursor/` file installs.

## Notes / caveat

- Current Cursor docs say plugins require `.cursor-plugin/plugin.json` and can bundle rules, skills, agents, commands, hooks, and MCP servers.
- Team Marketplace supports Required and Optional distribution. Required auto-installs the plugin for everyone in the distribution group after an admin saves it.
- Team marketplaces are available on Teams and Enterprise plans; Enterprise plans can have unlimited team marketplaces.
- Enterprise third-party plugin imports / third-party skills may require admin enablement; document that admin setup is part of the install path.
- Consider whether `.cursor/` file install stays the default and the plugin is the team/enterprise path.
- Coordinate with `JFBFEP` before bundling MCP defaults. Arcade should keep MCP first-class, but plugin packaging must not silently grant side-effecting MCP tools.

## Done when

- A `.cursor-plugin/plugin.json` manifest bundles safeword's Cursor surfaces.
- Team Marketplace install modes, including Required, are documented.
- Local plugin testing path (`~/.cursor/plugins/local`) is documented.
- MCP bundling either uses the action-based policy from `JFBFEP` or explicitly stays out of scope for the first plugin release.
- Enterprise/team admin caveats are called out.

## Source

- Cursor plugins docs and plugin reference (`.cursor-plugin/plugin.json`, component discovery, hooks, MCP servers, local testing).
- Cursor Team Marketplace docs (Required vs Optional distribution).
- Cursor May 1 2026 changelog (Team Marketplace Required mode).

## Work Log

- 2026-05-31 Created from Cursor research.
- 2026-06-24 `/quality-review` refreshed against current Cursor plugin docs. The
  ticket is still needed, but the source should be docs-first now: plugin manifest,
  local plugin testing, Team Marketplace Required/Optional distribution, and MCP
  bundling coordination with `JFBFEP`.
