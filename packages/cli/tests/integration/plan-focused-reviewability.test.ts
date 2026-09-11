import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

it('keeps Implementation Plan decisions focused and reviewable', { timeout: 60_000 }, () => {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      './node_modules/.bin/cucumber-js',
      'features/approve-coherent-implementation-plans.feature',
      '--name',
      '^Decision presentation controls focused reviewability$',
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  expect(
    result.status,
    `focused reviewability did not preserve the architecture-first decision path\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  ).toBe(0);
  expect(result.stdout).toMatch(/5 scenarios \(5 passed\)/);
});
