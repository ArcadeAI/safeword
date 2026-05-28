---
id: 04NKDR
slug: check-schema-parity
type: task
phase: intake
status: in_progress
created: 2026-05-28T18:03:05.577Z
last_modified: 2026-05-28T18:03:05.577Z
---

# bun run check:schema templates-to-schema parity

**Goal:** Add a fast `bun run check:schema` script that asserts every file under `templates/` has a matching `SAFEWORD_SCHEMA` entry (ownedFiles/managedFiles `template:`) and no orphan entries — the parity the full `schema.test.ts` already checks, but runnable on its own (and optionally wired into pre-commit).

**Why:** A template added without a schema entry (e.g. `spec-template.md` in Y2HCNJ slice A) currently surfaces only at full-suite time — minutes-long feedback for a one-line omission. A standalone parity check gives sub-second feedback at edit/commit time. Repo-infra/contributor-experience.

## Work Log

- 2026-05-28T18:03:05.577Z Started: Created ticket 04NKDR
