---
id: 154
status: in_progress
phase: implement
type: task
scope:
  - Remove the `version` field from the `SafewordConfig` TypeScript interface in `packages/cli/src/packs/config.ts`.
  - Stop writing `version` in `addInstalledPack`'s default config.
  - Add a one-time strip migration in `packages/cli/src/commands/upgrade.ts` that drops `version` from existing `.safeword/config.json` files after reconcile.
out_of_scope:
  - Touching `.safeword/version` (plaintext source-of-truth file, unchanged).
  - Changing the `installedPacks` or `autoUpgrade` fields.
  - Hand-editing `arcade-deep-research/.safeword/config.json` (will self-heal on its next upgrade).
  - Schema changes to `.safeword/config.json`'s ownership entry in `schema.ts` (the `generator: () => undefined` stays — packs system still owns the file).
  - Any backfill of `autoUpgrade` defaults or other config refactors.
done_when:
  - `SafewordConfig` interface has no `version` field.
  - Fresh projects get a `config.json` without a `version` key.
  - Existing projects shed the `version` key on next `safeword upgrade`.
  - All tests pass (`bun run test` from `packages/cli/`).
  - Lint clean.
---

# Task: Strip dead `version` field from .safeword/config.json

**Type:** Refactor (dead-state removal)

**Goal:** Remove a write-once / never-read `version` field from `.safeword/config.json` that has caused a reasoning-LLM to flag projects as "stale" (real incident in `arcade-deep-research`, v0.25.14 → v0.32.1 upgrade). Plaintext `.safeword/version` is the live source of truth; the JSON field is vestigial state.

## Why now

A previous Claude session upgrading arcade-deep-research correctly noted version drift, but misattributed it. The investigation showed:

- `.safeword/version` (regenerated every reconcile by `schema.ts:256`) is the live truth.
- `.safeword/config.json`'s `version` field is written once at first pack install via `addInstalledPack` and never refreshed. Grep across `packages/cli/src/` for `config.version` returns zero reads.
- Functional impact: none. Reasoning-LLM-confusion impact: real, will recur on every project that upgrades past where its config was first written.

## Approach

1. Drop `version` from `SafewordConfig` interface and from `addInstalledPack`'s `??` default in `packages/cli/src/packs/config.ts`.
2. In `packages/cli/src/commands/upgrade.ts`, after the existing `reconcile(...)` call, read `.safeword/config.json` if it exists; if it has a `version` key, delete it and rewrite. ~5 lines.
3. Test: unit for the strip behavior (existing config with `version` → next upgrade → field gone).

## Tests

- [ ] Unit: `addInstalledPack` on a fresh project writes a config without a `version` field.
- [ ] Unit: `upgrade` on a project whose `config.json` has `version: "0.25.14"` strips the field while preserving `installedPacks` and `autoUpgrade`.
- [ ] Unit: `upgrade` on a project whose `config.json` already lacks `version` is a no-op for that file.

## Work Log

- 2026-05-18T18:15Z Created ticket. Diagnosis pre-confirmed: dead state, no consumers. Strip placement chosen = `upgrade.ts` (reliable, fires via auto-upgrade hook). Sizing = task (2 files, 1 testable behavior + 1 migration behavior).
