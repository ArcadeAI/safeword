import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCliWithoutInstall } from '../helpers.js';

describe('project public-retros', () => {
  it('turns collection off without changing the project identity', async () => {
    const directory = createTemporaryDirectory();
    const configPath = nodePath.join(directory, '.safeword/config.json');
    mkdirSync(nodePath.dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      `${JSON.stringify({
        projectUUID: '11111111-2222-3333-4444-555555555555',
        publicRetrospectiveCollection: true,
      })}\n`,
    );

    const result = await runCliWithoutInstall(
      ['project', 'public-retros', 'off', '--json', '--cwd', directory],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ state: 'changed', changed: true });
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual({
      projectUUID: '11111111-2222-3333-4444-555555555555',
      publicRetrospectiveCollection: false,
    });
  });
});
