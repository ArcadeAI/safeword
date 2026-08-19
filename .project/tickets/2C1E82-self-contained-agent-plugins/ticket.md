---
id: 2C1E82
slug: self-contained-agent-plugins
type: epic
phase: intake
status: in_progress
children: ['V2AH4B']
created: 2026-08-18T16:58:37.428Z
last_modified: 2026-08-18T16:58:37.428Z
---

# Make each agent's plugin fully self-contained

**Goal:** Neither Claude nor Codex should depend on project-local .safeword/hooks, .safeword/skills, or .safeword/scripts once selected without the other — each plugin package ships and runs its own copies

**Why:** Claude has already packaged guides/scripts/hooks into the plugin bundle but a few wiring gaps (dispatch.js env var, unconditional install schema) still leave stale project-local .safeword content around with no auto-upgrade path; Codex still shells out to project-local .safeword/hooks and .safeword/scripts directly from its skills, unlike its already-self-contained lifecycle hooks (bunx --bun safeword@version)

## Work Log

- 2026-08-18T16:58:37.428Z Started: Created ticket 2C1E82
