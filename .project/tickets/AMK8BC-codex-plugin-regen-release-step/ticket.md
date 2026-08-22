---
id: AMK8BC
slug: codex-plugin-regen-release-step
type: patch
phase: intake
status: in_progress
created: 2026-08-20T05:05:41.535Z
last_modified: 2026-08-20T05:05:41.535Z
---

# Document the Codex catalogue regeneration step for releases

**Goal:** Add 'bun run generate:codex-plugin' to the release-tracked artifact list in AGENTS.md and the versioning skill

**Why:** Generated Codex skills now embed the safeword@<version> pin, so a version bump that skips regeneration ships stale pins; test:release catches it loudly but the checklist still names only four artifacts

## Work Log

- 2026-08-20T05:05:41.535Z Started: Created ticket AMK8BC
