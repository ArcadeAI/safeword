import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizePluginCliBundle } from '../../scripts/lib/build-plugin-cli-bundle.js';
import {
  assertClaudePluginAssetReferences,
  generateClaudePluginAssets,
} from '../../src/claude-plugin/catalogue.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');

describe('Claude plugin catalogue generation', () => {
  it('normalizes machine-specific Bun install instance paths', () => {
    const firstBundle = [
      '// ../../node_modules/.bun/@secretlint+core@13.0.4+2b91fc17bf64bdfd/node_modules/@secretlint/core/index.js',
      '// ../../node_modules/.bun/debug@4.4.3+2b91fc17bf64bdfd/node_modules/debug/src/index.js',
      'console.log("bundle");',
    ].join('\n');
    const secondBundle = firstBundle.replaceAll('2b91fc17bf64bdfd', '7f1b8241f77f2ecc');

    const normalized = normalizePluginCliBundle(firstBundle);

    expect(normalized).toBe(normalizePluginCliBundle(secondBundle));
    expect(normalized).toContain(
      'node_modules/.bun/@secretlint+core@13.0.4/node_modules/@secretlint/core/index.js',
    );
    expect(normalized).toContain('node_modules/.bun/debug@4.4.3/node_modules/debug/src/index.js');
    expect(normalized).toContain('console.log("bundle");');
  });

  it('rejects generated assets that retain project-local skill references', () => {
    expect(() => {
      assertClaudePluginAssetReferences([
        {
          relativePath: 'agents/reviewer.md',
          content: 'Read .safeword/skills/finish-review/REVIEWER.md',
        },
      ]);
    }).toThrow('depends on project framework path .safeword/skills/finish-review/REVIEWER.md');
  });

  it('packages the handbook so SessionStart never needs project-local .safeword/SAFEWORD.md', () => {
    const assets = generateClaudePluginAssets({
      cliBundle: 'console.log("stub cli bundle");',
      sourceRoot: nodePath.join(packageRoot, 'src'),
      templatesRoot: nodePath.join(packageRoot, 'templates'),
      version: '0.0.0-test',
    });

    const packagedHandbook = assets.find(asset => asset.relativePath === 'resources/SAFEWORD.md');

    expect(packagedHandbook).toBeDefined();
    expect(packagedHandbook?.content.length).toBeGreaterThan(0);
    expect(packagedHandbook?.content).not.toMatch(/\.safeword\/(?:guides|scripts)\//u);
  });
});
