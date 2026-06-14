## Verify Checklist

**Test Suite:** ✓ 38/38 tests pass across 4 target files (lazy-config-loading 11/11, eslint-overrides preserved, sync-config 10/10, setup-architecture 7/7)
**Build:** ✅ Success (DTS now passes too — previously failed because of static plugin imports that couldn't be type-resolved in some build contexts)
**Lint:** ✅ Clean
**Scenarios:** All 11 scenarios marked complete (inline tests per task convention)
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** N/A

### Acceptance criteria (from ticket frontmatter)

- ✅ **Structural: 7 configs lazy-load** — Tests 1-7 in `tests/presets/lazy-config-loading.test.ts` assert each of storybook.ts / turbo.ts / astro.ts / playwright.ts / tanstack-query.ts / tailwind.ts / recommended-nextjs.ts has no top-level static `import xPlugin from '<package>'` for its plugin.
- ✅ **Behavioral: CJS-detectable plugins don't load** — subprocess test confirms `eslint-plugin-turbo`, `eslint-plugin-playwright`, `@next/eslint-plugin-next` are NOT in `require.cache` after `import { eslintPlugin } from '.../dist/presets/typescript/index.js'`. ESM-only plugins (storybook, astro, tanstack-query, better-tailwindcss) covered by structural test.
- ✅ **No semantic regression** — Tests 8-10 spread `configs.storybook` / `configs.tanstackQuery` / `configs.tailwind` and verify array shape + expected `name: 'safeword/X'` entries match pre-refactor.
- ✅ **safeword's own lint still passes** — `bun run lint` exits clean on this branch.
- ✅ **Universal plugins unchanged** — react, typescript-eslint, jsdoc, unicorn, etc. still eager-imported.

### Implementation notes

- New helper `packages/cli/src/presets/typescript/eslint-configs/lazy.ts` exposes `lazyConfigArray<T>(builder: () => T[]): T[]`. Returns a Proxy that defers the builder call until first array access (read, iterate, spread, `in`-test, `Object.keys`). Result cached after first call.
- Each of the 7 stack-specific config files refactored to the same shape:

  ```ts
  import { createRequire } from 'node:module';
  import { lazyConfigArray } from './lazy.js';
  const requireFromHere = createRequire(import.meta.url);

  export const xConfig: any[] = lazyConfigArray(() => {
    const xPlugin = requireFromHere('eslint-plugin-x');
    return [
      /* config */
    ];
  });
  ```

- `index.ts` unchanged structurally — still imports each `xConfig` named export and exposes via `eslintPlugin.configs.x`. The Proxy preserves the array contract, so consumers spreading `configs.x` work identically.
- DTS build bonus: previously failed in some contexts due to `eslint-plugin-storybook` static-import type resolution; now passes because the plugin reference is inside a function body via `createRequire` (typed as `any`).

Audit passed.

**Next:** commit + open PR.
