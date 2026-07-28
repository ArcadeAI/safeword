import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');
}

describe('local complete-test contract (#1455)', () => {
  it('runs the unit suite before the Gherkin acceptance suite', () => {
    const manifest = JSON.parse(readRepoFile('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(manifest.scripts?.test).toMatch(/\S/);
    expect(manifest.scripts?.['test:bdd']).toMatch(/\S/);
    expect(manifest.scripts?.['test:all']).toBe('bun run test && bun run test:bdd');
  });

  it('documents distinct complete and unit test commands', () => {
    const readme = readRepoFile('README.md');

    expect(readme).toMatch(/^bun run test:all[ \t]+# Unit and acceptance tests$/m);
    expect(readme).toMatch(/^bun run test[ \t]+# Vitest suite$/m);
  });
});
