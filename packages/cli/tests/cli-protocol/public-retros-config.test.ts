import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCliWithoutInstall } from '../helpers.js';

describe('project public-retros', () => {
  it.each([
    ['off', true, false],
    ['off', undefined, false],
    ['off', false, false],
    ['on', false, true],
    ['on', undefined, true],
    ['on', true, true],
  ] as const)(
    'turns collection %s from %s without changing the project identity',
    async (state, initialValue, storedValue) => {
      const directory = createTemporaryDirectory();
      const configPath = nodePath.join(directory, '.safeword/config.json');
      mkdirSync(nodePath.dirname(configPath), { recursive: true });
      const config: Record<string, unknown> = {
        projectUUID: '11111111-2222-3333-4444-555555555555',
      };
      if (initialValue !== undefined) config.publicRetrospectiveCollection = initialValue;
      writeFileSync(configPath, `${JSON.stringify(config)}\n`);

      const result = await runCliWithoutInstall(
        ['project', 'public-retros', state, '--json', '--cwd', directory],
        { cwd: directory },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual({
        projectUUID: '11111111-2222-3333-4444-555555555555',
        publicRetrospectiveCollection: storedValue,
      });
    },
  );
});
