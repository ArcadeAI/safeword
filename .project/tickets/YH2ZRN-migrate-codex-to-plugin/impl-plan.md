# Impl Plan: Move Codex users to the Safe Word plugin

**Status:** planned

## Approach

**Riskiest assumption:** Codex can report a plugin as installed without it being
enabled. The cheapest proof is the `Disabled plugin retains legacy hooks`
scenario: a fake Codex profile reports `enabled: false`, and migration must fail
before writing `.codex/config.toml`.

| Scenario / surface | Primary proof | Supporting proof |
| --- | --- | --- |
| Upgrade retains legacy hooks | Integration | Snapshot a legacy config before and after the public `upgrade` command. |
| Fresh setup creates no hooks | Integration | Run public `setup`; assert no Safe Word `.codex/config.toml` exists. |
| Verified migration replaces hooks | Integration | Fake `codex` and isolated `CODEX_HOME` assert add, install, enabled verification, then cleanup. |
| Failed, disabled, missing-Bun migration retains hooks | Integration | Inject each pre-cleanup failure and assert byte-for-byte unchanged project config plus remediation. |
| Custom hooks survive | Integration | Mixed TOML fixture proves only Safe Word command stanzas are removed. |
| Bunx-only contract | Release | Require exact hook commands and reject all Codex `npx` strings. |
| Packed artifact and live profile | Release / E2E | Inspect the pack, then run Codex against a temporary profile and Bunx shim. |

Build order:

1. Add the source-repository marketplace manifest and migration module; start
   with the disabled-plugin RED test.
2. Add `safeword migrate codex-plugin`: preflight Bun and Codex, add the
   marketplace and plugin, then parse `plugin list --json` for exact enabled
   verification. Do not mutate the project before this succeeds.
3. Remove only Safe Word hook registration blocks from `.codex/config.toml`.
4. Remove Codex project assets and hook patches from the normal schema path;
   normal setup and upgrade leave legacy configuration untouched.
5. Update README, website docs, and ARCHITECTURE.md for Bun, profile scope, and
   the explicit migration.
6. Run package, live-profile, quality, audit, refactor, and regression checks
   after catching up with `main`.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Trigger | Explicit `safeword migrate codex-plugin` | Automatic setup/upgrade; manual Codex instructions | Profile installation needs consent; manual steps make cleanup ordering unsafe. |
| Distribution | Public Safe Word repository marketplace with sparse plugin paths | Copy assets into customer repo; local-only instructions | Marketplace plugins live in the profile cache, without recreating repo clutter. |
| Cleanup | Remove only Safe Word hook stanzas after verification | Delete config; ordinary-upgrade cleanup | `.codex/config.toml` may contain user work and regular upgrade must not strand users. |
| Runtime | Exact `bunx --bun safeword@<version>` | `npx`; unpinned Bunx | The chosen Codex path requires Bun and must prevent CLI/plugin skew. |
| Tests | Fake-process integration plus packed and live proof | Unit-only; live-only | Integration proves ordering; package and live tests prove distribution. |

`/figure-it-out` evidence: the current Codex CLI accepts marketplace add, plugin
add, and `plugin list --json`; that response exposes `installed` and `enabled`.
Marketplace distribution wins because Codex caches it outside the project.

**Premortem:** A future Codex CLI changes JSON shape; parse only the required
fields, treat missing fields as unverified, and retain the live-profile smoke.

## Arch alignment

Honors `ARCHITECTURE.md`'s schema-as-single-source-of-truth and reconciliation
principle: normal reconciliation no longer owns Codex integration, while the
explicit migration uses a narrow ownership-aware transformation. This is
feature-specific and does not require an ADR.

## Known deviations

The current architecture describes `templates/codex/` as a project config
surface. This change intentionally removes it because Codex plugin and project
hooks run additively. ARCHITECTURE.md changes with the implementation.

## Doc impact

- `README.md`: remove project-hook and npx descriptions; document Bun and the
  migration command.
- `packages/website/src/content/docs`: update relevant Codex installation pages.
- `ARCHITECTURE.md`: document the marketplace/plugin and explicit migration.

## Assessment triggers

Revisit if Codex introduces project-scoped plugins, changes marketplace or
enabled-state JSON, supports plugin runtime dependencies, or Safe Word needs a
Node-compatible Codex hook path.

