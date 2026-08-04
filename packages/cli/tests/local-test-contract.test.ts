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

    expect(manifest.scripts).toEqual(
      expect.objectContaining({
        test: expect.stringMatching(/\S/),
        'test:bdd': expect.stringMatching(/\S/),
        'test:all': expect.stringMatching(/\S/),
      }),
    );
    const commands = (manifest.scripts?.['test:all'] ?? '')
      .split('&&')
      .map(command => command.trim());

    expect(commands).toHaveLength(2);
    expect(commands[0] ?? '').toMatch(/(?:^|\s)test(?:\s|$)/);
    expect(commands[1] ?? '').toMatch(/\btest:bdd\b/);
  });

  it('documents the root and package test commands from their matching directories', () => {
    const readme = readRepoFile('README.md');

    expect(readme).toMatch(
      /^# From the repo root\nbun run test:all\b[^\n]*\nbun run test:bdd\b[^\n]*\n\n/m,
    );
    expect(readme).toMatch(/^# From packages\/cli\n(?:#[^\n]*\n)*bun run test[ \t]/m);
  });
});
