---
id: 0VG5AC
slug: claude-plugin-drop-safeword-dependency
type: task
phase: intake
status: in_progress
parent: 2C1E82
created: 2026-08-18T16:42:22.427Z
last_modified: 2026-08-18T16:42:22.427Z
---

# Stop native Claude plugin from depending on project-local .safeword content

**Goal:** Wire SAFEWORD_PACKAGED_CONTEXT_PATH into Claude's dispatch.js (pointing at the plugin's own resources/, mirroring how Codex's runtime already sets it) so SessionStart points at the packaged handbook/guides instead of .safeword/SAFEWORD.md and .safeword/guides/; also stop installing .safeword/hooks/*, .safeword/skills/*, and .safeword/scripts/* when neither Codex nor Cursor is selected, since native Claude never reads them

**Why:** Investigation found plugin/resources/guides/ and plugin/resources/scripts/ already contain byte-identical copies of every guide and script, and Claude's own skills already reference them via ${CLAUDE_PLUGIN_ROOT}/resources/guides/... and ${CLAUDE_PLUGIN_ROOT}/resources/scripts/... (e.g. closeout, cleanup-zombies), but dispatch.js never sets SAFEWORD_PACKAGED_CONTEXT_PATH the way Codex's runtime does, so the SessionStart bootstrap hook still falls back to telling the agent to read .safeword/guides/. Separately, .safeword/hooks/*.ts, .safeword/skills/*, and .safeword/scripts/*are still unconditionally installed even for Claude-only (no Codex, no Cursor) projects even though nothing in native Claude's dispatch path (which runs entirely from ${CLAUDE_PLUGIN_ROOT}/runtime/hooks/ and plugin/skills/) reads them - they are Codex/Cursor-exclusive dependencies today (Codex's closeout/cleanup-zombies skills shell out to the project-local .safeword/scripts/* directly). This is also what's silently leaving stale, unmonitored .safeword content on disk with no auto-upgrade path (arcade-monorepo session 68727f80 found stuck on .safeword/version 0.76.0 while npm/plugin cache were already at 0.78.5).

## Work Log

- 2026-08-18T16:42:22.427Z Started: Created ticket 0VG5AC
- 2026-08-18T16:52:00.000Z Expanded scope to include .safeword/scripts/* — confirmed plugin/resources/scripts/ already has byte-identical bundled copies and Claude skills already reference the packaged path, so scripts belong in the same Codex/Cursor-only install condition as hooks/skills.
