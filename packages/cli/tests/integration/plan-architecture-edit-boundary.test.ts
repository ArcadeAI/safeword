import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

it(
  'permits only configured durable architecture records during planning',
  { timeout: 65_000 },
  () => {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        './node_modules/.bin/cucumber-js',
        'features/approve-coherent-implementation-plans.feature',
        '--name',
        '^Planning access permits only configured durable architecture records$',
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        timeout: 60_000,
      },
    );
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    expect(result.status, `architecture edit-boundary check failed\n${output}`).toBe(0);
    expect(output).toMatch(/8 scenarios \(8 passed\)/);
  },
);
