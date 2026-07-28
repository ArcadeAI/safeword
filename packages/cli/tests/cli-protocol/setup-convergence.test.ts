import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCliWithoutInstall } from '../helpers.js';

describe('convergent setup', () => {
  it('reports changed once and unchanged on an identical second run', async () => {
    const directory = createTemporaryDirectory();
    const arguments_ = [
      'setup',
      '--json',
      '--no-input',
      '--offline',
      '--cwd',
      directory,
      '--no-modify',
    ];

    const first = await runCliWithoutInstall(arguments_, { cwd: directory });
    expect(first.exitCode).toBe(0);
    expect(first.stderr).toBe('');
    expect(JSON.parse(first.stdout)).toMatchObject({
      state: 'changed',
      changed: true,
    });

    const second = await runCliWithoutInstall(arguments_, { cwd: directory });
    expect(second.exitCode).toBe(0);
    expect(second.stderr).toBe('');
    expect(JSON.parse(second.stdout)).toMatchObject({
      state: 'healthy',
      changed: false,
    });
  });
});
