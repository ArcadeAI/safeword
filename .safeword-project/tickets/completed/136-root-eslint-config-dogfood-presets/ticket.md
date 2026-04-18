---
id: '136'
slug: root-eslint-config-dogfood-presets
type: task
phase: done
status: done
created: 2026-04-17
parent: '120'
scope:
  - Switch root `eslint.config.mjs` to `defineConfig` from `eslint/config` — matches what `safeword setup` now generates
  - In `cli-package-override` block: replace preset-overlapping rules with `extends: [configs.cli, configs.relaxedTypes]`. Keep non-preset extras (`jsdoc/*`, `require-await`) inline
  - In `config-files-override` block: replace preset-overlapping rules with `extends: [configs.relaxedTypes]`
  - In `website-package-override` block: replace preset-overlapping rules with `extends: [configs.relaxedTypes]`. Keep `import-x/no-unresolved` inline
out_of_scope:
  - Aggressive replacement that collapses non-preset extras — keep extras explicit
  - Touching `packages/cli/eslint.config.mjs` — ticket 120 already cleaned that up
  - Touching `.safeword/eslint.config.mjs` — hook-level, intentionally unchanged per ticket 120
done_when:
  - Root `eslint.config.mjs` uses `defineConfig`
  - The three override blocks use `extends:` for preset-overlapping rules; extras remain inline
  - `bun run lint` from repo root passes with zero new errors
  - Targeted eslint-configs tests still pass (`cd packages/cli && npx vitest run src/presets/typescript/eslint-configs/__tests__/`)
---

# Root ESLint Config: Dogfood the configs.cli/relaxedTypes Presets

## Problem

Ticket 120 moved `overrides.cli`/`overrides.relaxedTypes` to `configs.cli`/`configs.relaxedTypes` and dogfooded them in `packages/cli/eslint.config.mjs`. The repo-root `eslint.config.mjs` still carries ~14 rules inline across three file-scoped override blocks — the exact rules the presets now encode. This is the residual drift that ticket 120's "Discovery Context" originally flagged.

## Why conservative

Each override block mixes preset-overlapping rules with block-specific extras:

- `cli-package-override`: has `jsdoc/require-param` family + `@typescript-eslint/require-await` — not in any preset
- `website-package-override`: has `import-x/no-unresolved` — Astro-specific, not in preset

Replacing _everything_ would lose those extras. Replacing _only the overlaps_ via `extends:` keeps the extras explicit and lets the presets evolve in one place.

## Design

Use the `extends:` feature inside each file-scoped config block (enabled by `defineConfig`). Keep extras as inline `rules` in the same block.

```js
{
  name: 'cli-package-override',
  files: ['packages/cli/**/*.ts', 'packages/cli/**/*.mjs'],
  extends: [safeword.configs.cli, safeword.configs.relaxedTypes],
  rules: {
    'jsdoc/require-param': 'off',          // extras
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-returns': 'off',
    'jsdoc/require-jsdoc': 'off',
    '@typescript-eslint/require-await': 'off',
  },
}
```

## Work Log

- 2026-04-17 Spawned from ticket 120 review. Conservative scope chosen to preserve non-preset extras. Confirmed blast radius is root `eslint.config.mjs` only — `packages/cli/eslint.config.mjs` already cleaned up, hook-level `.safeword/eslint.config.mjs` intentionally untouched.
- 2026-04-17 Implementation. Switched root config to `defineConfig` from `eslint/config`. `cli-package-override` now uses `extends: [configs.cli, configs.relaxedTypes]` with only `jsdoc/*` + `require-await` inline (the non-preset extras). `config-files-override` and `website-package-override` collapsed to `extends: [configs.relaxedTypes]`; website keeps `import-x/no-unresolved` inline (Astro virtual modules). Net: 14 inline rule toggles eliminated, 3 blocks now reference presets directly. Drift source is closed — presets are the single source of truth.
- 2026-04-17 Verification: `npx eslint .` from repo root exits 0. Full eslint-configs suite 171/171 passes. No regressions.
- 2026-04-17 Quality review surfaced one real finding: `@typescript-eslint/restrict-template-expressions` is in `configs.relaxedTypes` but was not in the original inline lists for `website-package-override` or `config-files-override` (it WAS in `cli-package-override`). Extending `relaxedTypes` in those two blocks now also turns that rule off where it was previously on. Practical impact is near-zero — `packages/website/src/` is ~0 TypeScript code (mostly .mdx), and .config files rarely template-interpolate. Decision: accept the expansion as intentional. Invariant confirmed with user: presets are the single source of truth; inline per-block exceptions defeat the refactor. No inline comments added describing preset contents — they duplicate what the preset name already conveys and go stale when presets evolve.
