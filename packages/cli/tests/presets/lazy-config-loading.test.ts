/**
 * Test Suite: Lazy ESLint Plugin Loading
 *
 * Ticket H150ZW: stack-specific ESLint plugins (Storybook, Turbo, Astro, Playwright,
 * TanStack Query, better-tailwindcss, Next.js) must NOT load into Node memory when
 * a consumer simply imports `eslintPlugin`. Customer's generated eslint.config.mjs
 * already gates plugin USE behind `detect.has*(deps)`; this asserts plugin LOAD is
 * gated to match.
 *
 * Two layers of verification:
 *
 * 1. **Structural test (deterministic):** each config source file must not have a
 *    top-level static `import xPlugin from '<eslint-plugin-name>'`. The plugin must
 *    be loaded inside a function body via createRequire or dynamic import.
 *
 * 2. **Behavioral test (subprocess):** spawn a fresh Node process, import the
 *    built `eslintPlugin`, inspect `require.cache` for the CJS-detectable plugins.
 *    Only reliably catches CJS or CJS-entry-having plugins (turbo, playwright,
 *    @next/eslint-plugin-next); ESM-only plugins are covered by the structural test.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const CLI_ROOT = nodePath.resolve(__dirname, '../..');

/** Source file → package name it must lazy-load. */
const STACK_CONFIG_SOURCES: readonly { source: string; pluginPackage: string }[] = [
  {
    source: 'src/presets/typescript/eslint-configs/storybook.ts',
    pluginPackage: 'eslint-plugin-storybook',
  },
  {
    source: 'src/presets/typescript/eslint-configs/turbo.ts',
    pluginPackage: 'eslint-plugin-turbo',
  },
  {
    source: 'src/presets/typescript/eslint-configs/astro.ts',
    pluginPackage: 'eslint-plugin-astro',
  },
  {
    source: 'src/presets/typescript/eslint-configs/playwright.ts',
    pluginPackage: 'eslint-plugin-playwright',
  },
  {
    source: 'src/presets/typescript/eslint-configs/tanstack-query.ts',
    pluginPackage: '@tanstack/eslint-plugin-query',
  },
  {
    source: 'src/presets/typescript/eslint-configs/tailwind.ts',
    pluginPackage: 'eslint-plugin-better-tailwindcss',
  },
  {
    source: 'src/presets/typescript/eslint-configs/recommended-nextjs.ts',
    pluginPackage: '@next/eslint-plugin-next',
  },
];

/** CJS-loadable plugins where require.cache inspection is reliable. */
const CJS_DETECTABLE_PLUGINS = [
  'eslint-plugin-turbo',
  'eslint-plugin-playwright',
  '@next/eslint-plugin-next',
];

/**
 * Match every top-level `import ... from '<package>'` statement in a source file
 * and return the captured package names. Static regex (no dynamic construction)
 * so we don't trip `security/detect-non-literal-regexp`.
 */
const TOP_LEVEL_IMPORT_RE = /^[ \t]*import\s[^;]*?\sfrom\s+['"]([^'"]+)['"][ \t]*;?$/gm;

function topLevelImportedPackages(sourceContent: string): string[] {
  const packages: string[] = [];
  for (const match of sourceContent.matchAll(TOP_LEVEL_IMPORT_RE)) {
    if (match[1]) packages.push(match[1]);
  }
  return packages;
}

describe('Lazy ESLint plugin loading (structural)', () => {
  for (const { source, pluginPackage } of STACK_CONFIG_SOURCES) {
    it(`${nodePath.basename(source)} does not statically import ${pluginPackage} at top level`, () => {
      const content = readFileSync(nodePath.join(CLI_ROOT, source), 'utf8');
      const topLevelImports = topLevelImportedPackages(content);
      expect(topLevelImports).not.toContain(pluginPackage);
    });
  }
});

describe('Lazy config array semantics (Proxy preserves array shape)', () => {
  it('configs.storybook still returns a spreadable array with rules', async () => {
    const { eslintPlugin } = await import('../../src/presets/typescript/index.js');
    const config = eslintPlugin.configs.storybook;
    expect(Array.isArray([...config])).toBe(true);
    expect(config.length).toBeGreaterThan(0);
    const rulesEntry = config.find(c => c && typeof c === 'object' && 'rules' in c);
    expect(rulesEntry).toBeDefined();
  });

  it('configs.tanstackQuery returns a spreadable array', async () => {
    const { eslintPlugin } = await import('../../src/presets/typescript/index.js');
    const config = eslintPlugin.configs.tanstackQuery;
    const spread = [...config];
    expect(spread.length).toBeGreaterThan(0);
    expect(spread[0]).toMatchObject({ name: 'safeword/tanstack-query' });
  });

  it('configs.tailwind returns a spreadable array', async () => {
    const { eslintPlugin } = await import('../../src/presets/typescript/index.js');
    const config = eslintPlugin.configs.tailwind;
    const spread = [...config];
    expect(spread.length).toBeGreaterThan(0);
    expect(spread[0]).toMatchObject({ name: 'safeword/tailwind' });
  });
});

describe('Lazy ESLint plugin loading (behavioral)', () => {
  it('does not eagerly load CJS-detectable plugins when eslintPlugin is imported', () => {
    const distributionEntry = nodePath.join(CLI_ROOT, 'dist/presets/typescript/index.js');
    const script = `
      import { eslintPlugin } from ${JSON.stringify(distributionEntry)};
      if (!eslintPlugin) throw new Error('eslintPlugin import failed');
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      const targets = ${JSON.stringify(CJS_DETECTABLE_PLUGINS)};
      const loaded = targets.filter(name =>
        Object.keys(require.cache).some(cachedPath =>
          cachedPath.includes('/node_modules/' + name + '/')
        )
      );
      process.stdout.write(JSON.stringify(loaded));
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      cwd: CLI_ROOT,
      timeout: 30_000,
    });
    if (result.status !== 0) {
      throw new Error(
        `Subprocess failed (status=${result.status}): ${result.stderr || result.stdout}`,
      );
    }
    const loaded = JSON.parse(result.stdout) as string[];
    expect(loaded).toEqual([]);
  });
});
