---
id: A4HG61
slug: managed-file-refresh
type: task
phase: intake
status: in_progress
created: 2026-07-05T19:28:43.052Z
last_modified: 2026-07-05T19:28:43.052Z
---

# Fingerprint-gated refresh of pristine managedFiles on upgrade

**Goal:** On upgrade, refresh a managed file to the current template only when its on-disk content is a recognized safeword revision (pristine), leaving customer-edited files untouched — so shipped fixes to managed configs reach existing installs without clobbering.

**Why:** managedFiles are documented as 'update if safeword content' (schema.ts:86,1095) but planManagedFilesActions skips all existing files with no content check (reconcile.ts:618), so shipped fixes to eslint/tsconfig/ruff/etc. never reach installed hosts. Closes #849.

## Work Log

- 2026-07-05T19:28:43.052Z Started: Created ticket A4HG61
- 2026-07-05T19:32 Found (design-blocking): ALL motivating managed configs are ctx-generated (`generator: ctx => …`) — eslint.config.mjs & tsconfig.json (packs/typescript/files.ts:254+), ruff.toml/mypy.ini/.importlinter (packs/python/files.ts:245+), .golangci.yml (golang), clippy.toml/rustfmt.toml (rust), .sqlfluff (sql). A static per-file revision-hash list (cucumber pattern) CANNOT fingerprint generator output across versions → covers only static managed files (BDD lane starters, customer-edited by design). To heal ctx-generated configs requires recording what safeword actually wrote (provenance manifest) — larger surface (persistent .safeword state, setup/upgrade write, uninstall/reset cleanup, forward-only adopt-baseline for existing installs). Re-converging scope with user before building.
