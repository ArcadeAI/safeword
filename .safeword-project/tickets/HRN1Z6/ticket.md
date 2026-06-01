---
id: HRN1Z6
slug: upgrade-eslint-plugin-jsdoc-v63
type: task
phase: done
status: done
created: 2026-05-27T19:51:15.569Z
last_modified: 2026-05-27T19:55:56.518Z
scope:
  - Bump `eslint-plugin-jsdoc` from `^62.9.0` to `^63.0.0` in both `packages/cli/package.json` (stays in `dependencies` — runtime dep of the published `safeword` package; customers consuming the preset need the plugin resolvable) and root `package.json`.
  - Move the root `package.json` jsdoc entry from `dependencies` to `devDependencies` — root is `"private": true`, eslint plugins are tooling. Mirrors the placement of `eslint-config-prettier` and `eslint` at the root. Bun's workspace hoisting is unchanged; the entry just lives in a different section.
  - If the root `dependencies` block becomes empty after the move, delete it.
  - Run `bun install` to refresh the lockfile.
  - Run `bun run lint` to confirm zero new violations. The v63 `require-throws` bug fix newly checks constructors (previously skipped), but safeword's two constructors (`SlugError`, `TicketIdCollisionError`) only call `super(...)` — neither contains an explicit `throw`, so the rule fix doesn't apply.
out_of_scope:
  - Migration to a different JSDoc rule config (e.g., switching from `flat/recommended-error` to a different preset).
  - Other outdated packages flagged by K7N2QM's audit (`eslint v10`, `knip` patch) — separate tracks.
  - Reviewing or cleaning up other dependency-categorization mismatches at the root — this ticket addresses only the jsdoc entry surfaced during investigation.
done_when:
  - `packages/cli/package.json` shows `"eslint-plugin-jsdoc": "^63.0.0"` in the `dependencies` section.
  - Root `package.json` shows `"eslint-plugin-jsdoc": "^63.0.0"` in the `devDependencies` section (NOT `dependencies`).
  - Lockfile (`bun.lock`) reflects the new resolved version.
  - `bun run lint` exits 0 with zero new violations (pre-existing violations, if any, are unchanged).
  - K7N2QM's audit W001 note about the deferred jsdoc upgrade is addressable as "closed in HRN1Z6."
---

# Upgrade eslint-plugin-jsdoc v62 → v63

**Goal:** Bump `eslint-plugin-jsdoc` from v62 to v63 across the monorepo and fix the root `package.json` categorization (currently in `dependencies`, belongs in `devDependencies`).

**Why:** Close audit W001 from K7N2QM. The v63 breaking change (drops Node 20) is already compatible — safeword pins `node >=22`. The `require-throws` fix doesn't apply to safeword's two no-throw constructors. Low-risk upgrade; bundling the categorization fix while in the file avoids a second touch.

## Investigation notes (2026-05-27)

- **v63.0.0 changes:** (1) bug fix to `require-throws` (no longer skips constructors); (2) BREAKING: drops Node 20.
- **Node compat:** `packages/cli/package.json:29` pins `"node": ">=22"` — already meets v63's new minimum.
- **`require-throws` exposure:** Safeword has two constructors. `SlugError.constructor` (`utils/slug.ts:15`) and `TicketIdCollisionError.constructor` (`utils/ticket-writer.ts:37`). Both call `super(...)` only; neither contains an explicit `throw`. The rule fix doesn't apply.
- **Config-name compatibility:** Safeword consumes `pluginJsdoc.configs['flat/recommended-error']` at `recommended.ts:31`. Key not renamed in v63.
- **Root pin investigation:** Root `eslint.config.ts:17` imports `safeword.configs.recommendedTypeScript`, which transitively imports `eslint-plugin-jsdoc`. ESLint resolves the plugin from root, so root needs the dep declared (defensive against drift in cli's deps). BUT it's currently in `dependencies` and should be in `devDependencies` — root is `"private": true`, and `eslint-config-prettier` / `eslint` at the root are correctly in `devDependencies`. The jsdoc entry is the lone outlier.

## Work Log

- 2026-05-27T19:51:15.569Z Started: Created ticket HRN1Z6
- 2026-05-27T19:52:00.000Z Investigation complete: v63 changes (Node 20 drop, require-throws constructor fix) are both safe for safeword. Bundled root `package.json` categorization fix into scope after discovering the jsdoc entry is in `dependencies` (other eslint root deps are in `devDependencies`). Phase intake → implement (architecture is one-line edits; decomposition unnecessary).
- 2026-05-27T19:55:56.518Z Complete: All three scope items shipped in commit `cdae6bd8`. `bun install` resolved `eslint-plugin-jsdoc@63.0.0` cleanly (12 packages installed, 1 removed). `bun run lint` exits 0 with zero output — no new violations from the v63 `require-throws` fix (as predicted; safeword's two constructors don't explicitly throw). verify.md saved with full evidence. Phase → done; closes K7N2QM audit W001.
