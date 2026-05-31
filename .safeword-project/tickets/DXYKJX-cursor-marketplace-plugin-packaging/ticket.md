---
id: DXYKJX
slug: cursor-marketplace-plugin-packaging
type: task
phase: intake
status: in_progress
epic: cursor-changelog-alignment
relates_to: VAX3Z2
---

# Package safeword as Cursor Team-Marketplace plugin (Required mode)

**Goal:** Ship safeword as a Cursor Team-Marketplace plugin bundling hooks + rules + commands/skills + MCP, with "Required" install mode for enforcement.

**Why:** May 2026 Team Marketplace lets a plugin bundle all surfaces; "Required" mode is exactly safeword's enforcement posture. Cleaner than ad-hoc `.cursor/` file installs.

## Notes / caveat

- Enterprise third-party plugin imports default **off** since 3.0 — document that an admin must opt in, or safeword won't load for enterprise users.
- Consider whether `.cursor/` file install stays the default and the plugin is the team/enterprise path.

## Done when

- A Cursor plugin manifest bundles safeword's surfaces; install modes (incl. Required) documented; enterprise default-off caveat called out.

## Source

cursor.com/changelog (3.0 enterprise plugin default-off; May 1 Team Marketplace / Required mode)

## Work Log

- 2026-05-31 Created from Cursor research.
