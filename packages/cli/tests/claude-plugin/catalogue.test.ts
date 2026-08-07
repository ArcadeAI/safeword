import { describe, expect, it } from 'vitest';

import {
  assertClaudePluginAssetReferences,
  normalizeClaudePluginCliBundle,
} from '../../src/claude-plugin/catalogue.js';

describe('Claude plugin catalogue generation', () => {
  it('normalizes machine-specific Bun install instance paths', () => {
    const firstBundle = [
      '// ../../node_modules/.bun/@secretlint+core@13.0.4+2b91fc17bf64bdfd/node_modules/@secretlint/core/index.js',
      '// ../../node_modules/.bun/debug@4.4.3+2b91fc17bf64bdfd/node_modules/debug/src/index.js',
      'console.log("bundle");',
    ].join('\n');
    const secondBundle = firstBundle.replaceAll('2b91fc17bf64bdfd', '7f1b8241f77f2ecc');

    const normalized = normalizeClaudePluginCliBundle(firstBundle);

    expect(normalized).toBe(normalizeClaudePluginCliBundle(secondBundle));
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
});
