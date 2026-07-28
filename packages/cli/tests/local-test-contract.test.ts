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

  it('documents the complete command without calling the unit suite every test', () => {
    const readme = readRepoFile('README.md');

    expect(readme).toContain('bun run test:all                  # Unit and acceptance tests');
    expect(readme).toContain('bun run test                      # Vitest suite');
  });
});
