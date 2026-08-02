---
id: Q7YCW0
slug: keep-finalized-codex-dogfood-projects-passing-ci
type: patch
phase: done
status: done
created: 2026-08-02T14:19:21.006Z
last_modified: 2026-08-02T15:39:19.000Z
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/1774
---

# Keep finalized Codex dogfood projects passing CI

**Goal:** Allow finalized Codex plugin-mode projects to pass dogfood parity and integration tests.

**Why:** Finalization deliberately removes legacy project-local hooks, but CI still assumes they exist.

## Work Log

- 2026-08-02T14:19:21.006Z Started: Created ticket Q7YCW0
- Reproduced: `bun scripts/parity-check.ts --mode=all` reports eight missing Codex migration hook pairs.
- Confirmed: the CI run fails the same pair list, plus Node tests that execute the removed dogfood Codex adapters.
- Implemented: retained Claude/Cursor-owned hooks during future Codex finalization; finalized projects now omit only Codex-exclusive parity pairs; source integration tests execute canonical templates for retired adapters.
- Verified: local dogfood parity reports 200 pairs and 8 contracts in sync; lint and the full test suite were run.
- Dogfood state: recovered the original migration transaction to restore shared hooks. A genuine new Codex session must record current plugin proof before this repository can safely finalize again.
- 2026-08-02T15:39:19.000Z Completed: user-approved closure after PR #1774 merged with CI green (lint, dogfood parity, and both Node test/acceptance lanes).

## Root Cause

Codex finalization uses one historical allowlist both to validate recovery and to decide which files to remove. That allowlist includes `session-safeword-context.ts`, `prompt-timestamp.ts`, and `prompt-retro-nudge.ts`, even though active Claude and Cursor configuration still runs those shared hooks. It also leaves the dogfood parity checker and source integration tests assuming Codex-exclusive adapters remain installed after plugin finalization.

Confirmed by reproducing parity locally and tracing the finalization mutation builder from `observeLegacyAssets()` through `CODEX_MIGRATION_SCHEMA.legacyFiles`; the active Claude and Cursor configuration names the same shared paths.

Ruled out: CI/runtime flakiness — the missing-file list is deterministic locally and in all three failing CI jobs. Ruled out: a plugin proof failure — `safeword codex status` reports a current, protected plugin state.
