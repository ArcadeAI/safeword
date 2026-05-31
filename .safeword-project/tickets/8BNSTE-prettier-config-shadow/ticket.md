---
id: 8BNSTE
slug: prettier-config-shadow
type: task
phase: intake
status: in_progress
created: 2026-05-31T02:58:03.132Z
last_modified: 2026-05-31T02:58:03.132Z
scope:
  - Add install-time detection of an existing prettier config in any form (`.prettierrc*`, `prettier.config.*`, and the `package.json` `"prettier"` key) via a new `existingPrettierConfig` signal, reusing the prefix-match patterns already in `lint-config.ts` so the install path and the lint hook share one detection rule.
  - Gate **both** safeword prettier-config writes on `!existingPrettierConfig` — the owned `.safeword/.prettierrc` (`files.ts:204`) and the managed root `.prettierrc` (`files.ts:271`) — so safeword never drops a `.prettierrc` that shadows a customer's `prettier.config.mjs`.
  - Thread `existingPrettierConfig` through `project-detector.ts` into `ProjectContext` (`packs/types.ts`).
  - Sync the `.safeword/`↔`packages/cli/templates/` lint-config mirror if the shared helper moves.
out_of_scope:
  - `existingFormatter` semantics (Biome/dprint/Rome) and the `eslint-config-prettier` decision — a project that uses prettier still wants prettier's eslint rules off, so the new signal is separate from `existingFormatter`, not folded into it.
  - The additive JSON-merge for a bare `.prettierrc` (`files.ts:367`) — it stays; it's already safe (preserves the user's `singleQuote`) and only fires when a `.prettierrc` is present.
  - Migrating/merging an existing customer prettier config into safeword's defaults, or reformatting anything — detection-and-skip only.
  - Recursing into workspace-package prettier configs — root-cwd detection matches how prettier resolves from cwd (same call made in 1J6JKP).
done_when:
  - A project whose only prettier config is `prettier.config.mjs` (or `.prettierrc.yaml`, or `package.json#prettier`) gets **no** `.prettierrc` and **no** `.safeword/.prettierrc` written by install; the customer's config is left as the sole resolved config.
  - A project with a bare `.prettierrc` (JSON) still gets the additive plugin/defaults merge, unchanged.
  - A project with no prettier config at all still gets safeword's `.prettierrc` as before.
  - Unit tests cover detection across config-filename variants + the package.json key; install/reconcile tests assert the skip; full suite + lint green; hook mirror synced.
---

# Install-time prettier config detection — stop .prettierrc shadowing prettier.config.\*

**Goal:** Make safeword install detect an existing prettier config in any form and skip writing its own `.prettierrc`, so it never silently shadows and reformats a customer's project.

**Why:** A customer using safeword had `prettier.config.mjs` (double-quote style). Install classified them as having no formatter, dropped a `.prettierrc` with `singleQuote: true`, which takes cosmiconfig precedence over `prettier.config.mjs`, and the next prettier run flipped 225 files double→single. Direct violation of safeword's additive-config principle (configs add, never replace customer choices).

## Root cause

Two disconnected formatter-detection systems:

- **Install-time:** `hasExistingFormatter()` (`packages/cli/src/presets/typescript/detect.ts:250`) checks only Biome/dprint/Rome (`ALTERNATIVE_FORMATTER_FILES`, line 71). Comment: "Returns false for Prettier since it's safeword's default." → `existingFormatter = false` for a `prettier.config.mjs` project.
- **Lint-time:** `detectPrettierConfig()` (`.safeword/hooks/lib/lint-config.ts:22`, from ticket 1J6JKP) correctly prefix-matches `.prettierrc*` AND `prettier.config.*` — but it's only wired into the session-start warning hook, never into install.

With `existingFormatter = false`:

- Managed `.prettierrc` generator (`packs/typescript/files.ts:266`) **creates** a new `.prettierrc` from `PRETTIER_DEFAULTS` (`singleQuote: true`, line 99).
- Owned `.safeword/.prettierrc` generator (`files.ts:200`) also writes the same defaults; the lint hook formats against it.
- The JSON-merge path (`files.ts:367`, `skipIfMissing`) can't reconcile a JS module, so it never touches `prettier.config.mjs`.
- Per prettier 3.8.3 cosmiconfig `searchPlaces`, a populated bare `.prettierrc` resolves ahead of `prettier.config.mjs` in the same dir → the new file wins → reformat.

Only non-`.prettierrc` forms are trapped: a bare `.prettierrc` JSON is create-if-missing (skipped) + additively merged; `prettier.config.*` / `.prettierrc.{yaml,js,mjs,…}` / `package.json#prettier` get shadowed.

## Fix (chosen: separate signal, Option B)

1. `detect.ts`: add `hasExistingPrettierConfig(cwd)` — prefix-match dir entries (`.prettierrc`, `prettier.config.`) + check `package.json` `"prettier"` key. Reuse the same prefix constants as `lint-config.ts` (unify the two systems).
2. `project-detector.ts`: compute `existingPrettierConfig` and add to `ProjectContext` (`packs/types.ts`).
3. `files.ts`: both prettier-config generators also `return` early when `existingPrettierConfig` is true (lines 204 and 271). Leave `existingFormatter` (and thus `eslint-config-prettier`) alone.
4. Sync `.safeword/`↔`templates/` mirror for any shared lib.

## Test plan (inline TDD)

- RED: detection unit test — `existingPrettierConfig` true for `prettier.config.mjs`, `.prettierrc.yaml`, `package.json#prettier`; false for none / alt-formatter-only.
- RED: install/reconcile test — project with only `prettier.config.mjs` → neither `.prettierrc` nor `.safeword/.prettierrc` written.
- Keep green: bare-`.prettierrc` additive merge; no-config still writes safeword's `.prettierrc`.

## Work Log

- 2026-05-31T02:58:03.132Z Started: Created ticket 8BNSTE
- 2026-05-31T02:59:00.000Z Investigated: confirmed root cause (install-time `hasExistingFormatter` ignores prettier by design; disconnected from hook-time `detectPrettierConfig`). Verified prettier 3.8.3 config precedence via docs. Not covered by 1J6JKP (hook-warning only) or 54XH90 (CI lint drift). Chose Option B (separate `existingPrettierConfig` signal) over broadening `existingFormatter` (would wrongly drop eslint-config-prettier).
