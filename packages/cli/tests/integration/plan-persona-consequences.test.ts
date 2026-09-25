import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

it('reviews every accepted persona consequence', { timeout: 65_000 }, () => {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      './node_modules/.bin/cucumber-js',
      'features/approve-coherent-implementation-plans.feature',
      '--name',
      '^Persona consequence coverage controls approach approval$',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: 60_000,
    },
  );
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  expect(result.status, `persona-consequence scenario failed\n${output}`).toBe(0);
  expect(output).toMatch(/8 scenarios \(8 passed\)/);
});
